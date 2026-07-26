import { app, BrowserWindow, dialog, ipcMain, nativeImage, screen, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
  BackgroundGalleryState,
  EMPTY_PROJECTOR_STATE,
  Hymn,
  IPC,
  ProjectorState,
} from "../shared/types";

if (started) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const PROJECTOR_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const PROJECTOR_WINDOW_VITE_NAME: string;

let controlWindow: BrowserWindow | null = null;
let projectorWindow: BrowserWindow | null = null;

/** Last state pushed from the control window — replayed to the projector
 * window whenever it (re)loads, so a projector reload never shows garbage. */
let lastState: ProjectorState = EMPTY_PROJECTOR_STATE;

/**
 * Resolves the app icon at runtime. Before packaging (dev/`start`), main.ts
 * runs from .vite/build/, two levels below the project root, so the source
 * assets/ folder is reachable directly. Once packaged, everything is
 * asar-archived except what's listed in packagerConfig.extraResource — the
 * assets folder gets copied there and is reachable via process.resourcesPath.
 */
function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "assets", "icon.png")
    : path.join(__dirname, "../../assets/icon.png");
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: "Only Believe — Hymns and Bible",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    controlWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    controlWindow.webContents.openDevTools();
  } else {
    controlWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function createProjectorWindow() {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const target = displays.length > 1 ? displays[1] : displays[0];

  projectorWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    title: "Only Believe — Projector",
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (PROJECTOR_WINDOW_VITE_DEV_SERVER_URL) {
    // Projector has its own HTML entry (projector.html), not the default
    // index.html the dev server serves at "/" — see vite.projector.config.ts.
    projectorWindow.loadURL(`${PROJECTOR_WINDOW_VITE_DEV_SERVER_URL}/projector.html`);
  } else {
    projectorWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${PROJECTOR_WINDOW_VITE_NAME}/projector.html`
      )
    );
  }

  projectorWindow.once("ready-to-show", () => {
    projectorWindow?.show();
    if (displays.length > 1) projectorWindow?.setFullScreen(true);
  });

  projectorWindow.on("closed", () => {
    projectorWindow = null;
  });
}

// ---------- IPC ----------

ipcMain.handle(IPC.OPEN_PROJECTOR, () => createProjectorWindow());

ipcMain.handle(IPC.CLOSE_PROJECTOR, () => {
  projectorWindow?.close();
});

ipcMain.handle(IPC.TOGGLE_FULLSCREEN, () => {
  if (!projectorWindow) return;
  projectorWindow.setFullScreen(!projectorWindow.isFullScreen());
});

// Control window pushes a new state; main relays it to the projector
// and remembers it so a freshly (re)loaded projector can catch up.
ipcMain.on(IPC.STATE_UPDATE, (_event, state: ProjectorState) => {
  lastState = state;
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.STATE_UPDATE, state);
  }
});

ipcMain.on(IPC.REQUEST_STATE, (event) => {
  event.sender.send(IPC.STATE_UPDATE, lastState);
});

// ---------- Custom songs ("special songs" outside the shipped hymnal) ----------
// Persisted as a flat JSON file in the app's userData folder so they survive
// updates/reinstalls of the app itself.

function customSongsPath(): string {
  return path.join(app.getPath("userData"), "custom-songs.json");
}

function readCustomSongs(): Hymn[] {
  try {
    const raw = fs.readFileSync(customSongsPath(), "utf-8");
    return JSON.parse(raw) as Hymn[];
  } catch {
    return [];
  }
}

function writeCustomSongs(songs: Hymn[]): void {
  fs.writeFileSync(customSongsPath(), JSON.stringify(songs, null, 2), "utf-8");
}

ipcMain.handle(IPC.SONGS_LIST, () => readCustomSongs());

ipcMain.handle(IPC.SONGS_SAVE, (_event, song: Hymn) => {
  const songs = readCustomSongs();
  const idx = songs.findIndex((s) => s.id === song.id);
  if (idx >= 0) {
    songs[idx] = song;
  } else {
    songs.push(song);
  }
  writeCustomSongs(songs);
  return songs;
});

ipcMain.handle(IPC.SONGS_DELETE, (_event, id: string) => {
  const songs = readCustomSongs().filter((s) => String(s.id) !== id);
  writeCustomSongs(songs);
  return songs;
});

ipcMain.handle(IPC.SONGS_IMPORT_FILE, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Song files", extensions: ["txt", "json"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { filename: path.basename(filePath), content };
});

// ---------- Background image gallery ----------
// The gallery persists a list of file PATHS (small, stable) plus which one
// is currently active. Thumbnails are generated on demand via Electron's
// built-in nativeImage resizer so the gallery listing stays light; the
// full-resolution image is only read (and base64-encoded) when an image
// is actually set active, since that's the one actually sent to the
// projector. Data URLs are used throughout because Chromium blocks
// file:// resource loads from a page served over http:// — which is
// exactly how the Vite dev server serves these windows.

interface BackgroundSettings {
  gallery: string[];
  activePath: string | null;
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readBackgroundSettings(): BackgroundSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
      activePath: parsed.activePath ?? null,
    };
  } catch {
    return { gallery: [], activePath: null };
  }
}

function writeBackgroundSettings(s: BackgroundSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2), "utf-8");
}

function fileToDataUrl(filePath: string): string | null {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    const buffer = fs.readFileSync(filePath);
    return `data:image/${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function thumbnailDataUrl(filePath: string): string | null {
  try {
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) return null;
    return img.resize({ width: 220 }).toDataURL();
  } catch {
    return null;
  }
}

function galleryState(): BackgroundGalleryState {
  const settings = readBackgroundSettings();
  const images = settings.gallery.flatMap((p) => {
    const thumbnail = thumbnailDataUrl(p);
    return thumbnail ? [{ path: p, thumbnail }] : [];
  });
  return { images, activePath: settings.activePath };
}

ipcMain.handle(IPC.BACKGROUND_GALLERY_LIST, () => galleryState());

ipcMain.handle(IPC.BACKGROUND_GALLERY_ADD, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const settings = readBackgroundSettings();
    const merged = Array.from(new Set([...settings.gallery, ...result.filePaths]));
    writeBackgroundSettings({ ...settings, gallery: merged });
  }
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_REMOVE, (_event, filePath: string) => {
  const settings = readBackgroundSettings();
  writeBackgroundSettings({
    gallery: settings.gallery.filter((p) => p !== filePath),
    activePath: settings.activePath === filePath ? null : settings.activePath,
  });
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_SET_ACTIVE, (_event, filePath: string) => {
  const settings = readBackgroundSettings();
  writeBackgroundSettings({ ...settings, activePath: filePath });
  return fileToDataUrl(filePath);
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_CLEAR_ACTIVE, () => {
  const settings = readBackgroundSettings();
  writeBackgroundSettings({ ...settings, activePath: null });
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_LOAD, () => {
  const { activePath } = readBackgroundSettings();
  if (!activePath) return null;
  return fileToDataUrl(activePath);
});

let lastBackground: string | null = null;

ipcMain.on(IPC.BACKGROUND_UPDATE, (_event, dataUrl: string | null) => {
  lastBackground = dataUrl;
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.BACKGROUND_UPDATE, dataUrl);
  }
});

ipcMain.on(IPC.BACKGROUND_REQUEST, (event) => {
  event.sender.send(IPC.BACKGROUND_UPDATE, lastBackground);
});

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  // The control window's voice-command feature needs microphone access.
  // This app has no third-party web content, so auto-granting media
  // permission for its own windows is safe (there's nothing untrusted
  // to accidentally give mic access to).
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  createControlWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
