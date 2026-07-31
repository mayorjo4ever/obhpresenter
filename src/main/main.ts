import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  net,
  protocol,
  screen,
  session,
} from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import QRCode from "qrcode";
import started from "electron-squirrel-startup";
import {
  BackgroundGalleryState,
  DisplayInfo,
  EMPTY_PROJECTOR_STATE,
  Hymn,
  IPC,
  MediaItem,
  MediaLibraryState,
  ProjectorState,
  WirelessStatus,
} from "../shared/types";

if (started) {
  app.quit();
}

// Custom scheme for streaming locally-added media (images/videos) into the
// projector window. Registered "standard" + "stream" so large video files
// are read off disk on demand rather than loaded fully into memory, and
// "corsEnabled" so it can be fetched from any origin — including the Vite
// dev server's http://localhost origin during `npm start`. Must be called
// before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "obh-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Video/image projection plays in the projector window, not the window the
// operator actually clicked "Go Live" in — Chromium's default autoplay
// policy requires a user gesture in the SAME page, which the projector
// window never gets. This is a standard, safe switch for a fully
// first-party kiosk-style app like this one.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const PROJECTOR_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const PROJECTOR_WINDOW_VITE_NAME: string;

let controlWindow: BrowserWindow | null = null;
let projectorWindow: BrowserWindow | null = null;

/** Last state pushed from the control window — replayed to the projector
 * window (and any wireless clients) whenever they (re)load, so a reload
 * never shows garbage. */
let lastState: ProjectorState = EMPTY_PROJECTOR_STATE;
let lastBackground: string | null = null;
let lastFont: string = "Georgia";
let lastFontColor: string = "#ffffff";

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

// ---------- Settings (single JSON file in userData) ----------

interface AppSettings {
  gallery: string[];
  activePath: string | null;
  selectedDisplayId: number | null;
  fontFamily: string;
  fontColor: string;
}

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
      activePath: parsed.activePath ?? null,
      selectedDisplayId: parsed.selectedDisplayId ?? null,
      fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Georgia",
      fontColor: typeof parsed.fontColor === "string" ? parsed.fontColor : "#ffffff",
    };
  } catch {
    return {
      gallery: [],
      activePath: null,
      selectedDisplayId: null,
      fontFamily: "Georgia",
      fontColor: "#ffffff",
    };
  }
}

function writeSettings(s: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2), "utf-8");
}

// ---------- Windows ----------

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
  const primary = screen.getPrimaryDisplay();
  const selectedId = readSettings().selectedDisplayId;
  const selected = selectedId ? displays.find((d) => d.id === selectedId) : null;
  const target = selected ?? (displays.length > 1 ? displays[1] : displays[0]);
  const isSecondary = target.id !== primary.id;

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
    if (isSecondary) projectorWindow?.setFullScreen(true);
  });

  projectorWindow.on("closed", () => {
    projectorWindow = null;
  });
}

// ---------- IPC: projector window lifecycle ----------

ipcMain.handle(IPC.OPEN_PROJECTOR, () => createProjectorWindow());

ipcMain.handle(IPC.CLOSE_PROJECTOR, () => {
  projectorWindow?.close();
});

ipcMain.handle(IPC.TOGGLE_FULLSCREEN, () => {
  if (!projectorWindow) return;
  projectorWindow.setFullScreen(!projectorWindow.isFullScreen());
});

// ---------- IPC: slide state relay ----------
// Control window pushes a new state; main relays it to the local projector
// window AND any connected wireless (WebSocket) clients, and remembers it
// so a freshly (re)loaded projector/client can catch up.

function broadcastToWireless(message: unknown): void {
  const data = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

ipcMain.on(IPC.STATE_UPDATE, (_event, state: ProjectorState) => {
  lastState = state;
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.STATE_UPDATE, state);
  }
  broadcastToWireless({ type: "state", payload: state });
});

ipcMain.on(IPC.REQUEST_STATE, (event) => {
  event.sender.send(IPC.STATE_UPDATE, lastState);
});

ipcMain.on(IPC.BACKGROUND_UPDATE, (_event, dataUrl: string | null) => {
  lastBackground = dataUrl;
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.BACKGROUND_UPDATE, dataUrl);
  }
  broadcastToWireless({ type: "background", payload: dataUrl });
});

ipcMain.on(IPC.BACKGROUND_REQUEST, (event) => {
  event.sender.send(IPC.BACKGROUND_UPDATE, lastBackground);
});

ipcMain.handle(IPC.FONT_LOAD, () => readSettings().fontFamily);

ipcMain.on(IPC.FONT_UPDATE, (_event, font: string) => {
  lastFont = font;
  writeSettings({ ...readSettings(), fontFamily: font });
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.FONT_UPDATE, font);
  }
  broadcastToWireless({ type: "font", payload: font });
});

ipcMain.on(IPC.FONT_REQUEST, (event) => {
  event.sender.send(IPC.FONT_UPDATE, lastFont);
});

ipcMain.handle(IPC.FONT_COLOR_LOAD, () => readSettings().fontColor);

ipcMain.on(IPC.FONT_COLOR_UPDATE, (_event, color: string) => {
  lastFontColor = color;
  writeSettings({ ...readSettings(), fontColor: color });
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.webContents.send(IPC.FONT_COLOR_UPDATE, color);
  }
  broadcastToWireless({ type: "font-color", payload: color });
});

ipcMain.on(IPC.FONT_COLOR_REQUEST, (event) => {
  event.sender.send(IPC.FONT_COLOR_UPDATE, lastFontColor);
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

// ---------- Media library (images/videos for full-screen projection) ----------
// Only the file path + a little metadata is persisted — never the file
// itself — since videos can be large and the operator's own files aren't
// going anywhere. Playback reads straight from disk on demand (see the
// obh-media:// protocol handler below, and the wireless server's /media/
// route), so nothing here is ever loaded fully into memory.

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "mkv", "avi", "m4v"];

function inferMediaKind(filePath: string): "image" | "video" | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return null;
}

function mediaLibraryPath(): string {
  return path.join(app.getPath("userData"), "media-library.json");
}

function readMediaLibrary(): MediaItem[] {
  try {
    const raw = fs.readFileSync(mediaLibraryPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MediaItem[]) : [];
  } catch {
    return [];
  }
}

function writeMediaLibrary(items: MediaItem[]): void {
  fs.writeFileSync(mediaLibraryPath(), JSON.stringify(items, null, 2), "utf-8");
}

function mediaLibraryState(): MediaLibraryState {
  // Files can be moved/deleted outside the app between sessions — quietly
  // drop entries that no longer resolve rather than showing broken tiles.
  const items = readMediaLibrary().filter((m) => fs.existsSync(m.filePath));
  return { items };
}

ipcMain.handle(IPC.MEDIA_LIST, () => mediaLibraryState());

ipcMain.handle(IPC.MEDIA_ADD, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images & Videos", extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
      { name: "Images", extensions: IMAGE_EXTENSIONS },
      { name: "Videos", extensions: VIDEO_EXTENSIONS },
    ],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const existing = readMediaLibrary();
    const existingPaths = new Set(existing.map((m) => m.filePath));
    const added: MediaItem[] = result.filePaths
      .filter((p) => !existingPaths.has(p))
      .flatMap((filePath) => {
        const kind = inferMediaKind(filePath);
        if (!kind) return [];
        return [
          {
            id: crypto.randomUUID(),
            name: path.basename(filePath, path.extname(filePath)),
            filePath,
            kind,
          },
        ];
      });
    writeMediaLibrary([...existing, ...added]);
  }
  return mediaLibraryState();
});

ipcMain.handle(IPC.MEDIA_REMOVE, (_event, id: string) => {
  writeMediaLibrary(readMediaLibrary().filter((m) => m.id !== id));
  return mediaLibraryState();
});

// ---------- Background image gallery ----------
// Thumbnails are generated on demand via Electron's built-in nativeImage
// resizer so the gallery listing stays light; the full-resolution image is
// only read (and base64-encoded) when an image is actually set active,
// since that's the one actually sent to the projector. Data URLs are used
// throughout because Chromium blocks file:// resource loads from a page
// served over http:// — which is exactly how the Vite dev server (and the
// wireless projection server) serve these windows.

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
  const settings = readSettings();
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
    const settings = readSettings();
    const merged = Array.from(new Set([...settings.gallery, ...result.filePaths]));
    writeSettings({ ...settings, gallery: merged });
  }
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_REMOVE, (_event, filePath: string) => {
  const settings = readSettings();
  writeSettings({
    ...settings,
    gallery: settings.gallery.filter((p) => p !== filePath),
    activePath: settings.activePath === filePath ? null : settings.activePath,
  });
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_SET_ACTIVE, (_event, filePath: string) => {
  const settings = readSettings();
  writeSettings({ ...settings, activePath: filePath });
  return fileToDataUrl(filePath);
});

ipcMain.handle(IPC.BACKGROUND_GALLERY_CLEAR_ACTIVE, () => {
  const settings = readSettings();
  writeSettings({ ...settings, activePath: null });
  return galleryState();
});

ipcMain.handle(IPC.BACKGROUND_LOAD, () => {
  const { activePath } = readSettings();
  if (!activePath) return null;
  return fileToDataUrl(activePath);
});

// ---------- Displays (wireless HDMI/Miracast dongles show up as a normal
// extended display — Windows/macOS handle the wireless part transparently,
// so this is really just "let the operator pick which monitor to use") ----------

function describeDisplay(d: Electron.Display): DisplayInfo {
  const primary = screen.getPrimaryDisplay();
  const selectedId = readSettings().selectedDisplayId;
  return {
    id: d.id,
    label: d.label && d.label.length > 0 ? d.label : `${d.size.width}×${d.size.height} display`,
    width: d.size.width,
    height: d.size.height,
    isPrimary: d.id === primary.id,
    isSelected: selectedId != null ? d.id === selectedId : d.id !== primary.id,
  };
}

function listDisplaysInfo(): DisplayInfo[] {
  return screen.getAllDisplays().map(describeDisplay);
}

function broadcastDisplaysChanged(): void {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(IPC.SCREEN_CHANGED, listDisplaysInfo());
  }
}

ipcMain.handle(IPC.SCREEN_LIST, () => listDisplaysInfo());

ipcMain.handle(IPC.SCREEN_USE, (_event, id: number) => {
  const settings = readSettings();
  writeSettings({ ...settings, selectedDisplayId: id });

  // If the projector is already open, move it live rather than requiring
  // a close/reopen.
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    const target = screen.getAllDisplays().find((d) => d.id === id);
    if (target) {
      const isSecondary = target.id !== screen.getPrimaryDisplay().id;
      projectorWindow.setFullScreen(false);
      projectorWindow.setBounds(target.bounds);
      if (isSecondary) projectorWindow.setFullScreen(true);
    }
  }
  return listDisplaysInfo();
});

// ---------- Wireless network projection (no dongle) ----------
// Serves the already-built projector page over the local WiFi network via
// plain HTTP + a WebSocket for live updates, so any device with a browser
// (smart TV, phone, tablet) can open a URL and see the live feed. This is
// NOT Chromecast/AirPlay — those are proprietary casting protocols that
// need platform SDKs; this is a plain "open this link" approach that works
// on literally any device with a browser on the same network, with no
// pairing step.

const wsClients = new Set<WebSocket>();
let httpServer: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let wirelessStatus: WirelessStatus = { running: false, url: null, qrDataUrl: null };
const WIRELESS_PORT = 5959;

function projectorDistDir(): string {
  return path.join(__dirname, `../renderer/${PROJECTOR_WINDOW_VITE_NAME}`);
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".m4v": "video/x-m4v",
  };
  return map[ext] ?? "application/octet-stream";
}

function getLanAddress(): string | null {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** Streams a local media file to a wireless (remote browser) client, with
 * HTTP Range support so video seeking/scrubbing works smoothly instead of
 * forcing a full re-download from byte 0 on every seek. */
function serveMediaFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string
): void {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const contentType = mimeType(filePath);
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : stats.size - 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

async function startWirelessServer(): Promise<WirelessStatus> {
  if (httpServer) return wirelessStatus;

  // In dev (`npm start`), the projector page is served live by Vite's own
  // dev server (e.g. http://localhost:5174) rather than written to disk —
  // there's nothing at projectorDistDir() until `npm run make` runs. So
  // that a developer can test wireless projection without packaging first,
  // proxy every request through to the dev server instead of reading
  // static files, whenever PROJECTOR_WINDOW_VITE_DEV_SERVER_URL is set.
  // In a packaged app that constant is undefined, so this falls through
  // to the normal static-file path below.
  const devServerUrl = PROJECTOR_WINDOW_VITE_DEV_SERVER_URL;
  const distDir = projectorDistDir();

  if (!devServerUrl && !fs.existsSync(path.join(distDir, "projector.html"))) {
    return {
      running: false,
      url: null,
      qrDataUrl: null,
      error: "Build the app first (npm run make) — network projection needs the packaged files.",
    };
  }

  const ip = getLanAddress();
  if (!ip) {
    return { running: false, url: null, qrDataUrl: null, error: "No WiFi/LAN network detected." };
  }

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = (req.url ?? "/").split("?")[0];
      if (reqPath === "/") reqPath = "/projector.html";

      // Media files (images/videos the operator added) live wherever the
      // operator's own files are on disk — never part of the Vite bundle
      // or dist dir — so this is handled before the dev-proxy/static-file
      // branches below, in both dev and packaged modes alike.
      if (reqPath.startsWith("/media/")) {
        const id = decodeURIComponent(reqPath.slice("/media/".length));
        const item = readMediaLibrary().find((m) => m.id === id);
        if (!item) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        serveMediaFile(req, res, item.filePath);
        return;
      }

      if (devServerUrl) {
        // Dev mode: our server is the only thing reachable on the LAN
        // (Vite's dev server only listens on localhost), so relay the
        // request to it and stream the response straight back through.
        const target = new URL(reqPath, devServerUrl);
        const proxyReq = http.request(
          target,
          { method: req.method, headers: req.headers },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on("error", () => {
          res.writeHead(502);
          res.end("Dev server unreachable — is `npm start` still running?");
        });
        req.pipe(proxyReq);
        return;
      }

      const filePath = path.join(distDir, decodeURIComponent(reqPath));
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeType(filePath) });
        res.end(data);
      });
    });

    const sockets = new WebSocketServer({ server, path: "/ws" });
    sockets.on("connection", (ws) => {
      wsClients.add(ws);
      ws.send(JSON.stringify({ type: "state", payload: lastState }));
      ws.send(JSON.stringify({ type: "background", payload: lastBackground }));
      ws.send(JSON.stringify({ type: "font", payload: lastFont }));
      ws.send(JSON.stringify({ type: "font-color", payload: lastFontColor }));
      ws.on("close", () => wsClients.delete(ws));
    });

    server.on("error", () => {
      resolve({ running: false, url: null, qrDataUrl: null, error: "Could not start the server (port may be in use)." });
    });

    server.listen(WIRELESS_PORT, "0.0.0.0", () => {
      httpServer = server;
      wsServer = sockets;
      const url = `http://${ip}:${WIRELESS_PORT}`;
      QRCode.toDataURL(url).then((qrDataUrl) => {
        resolve({ running: true, url, qrDataUrl });
      });
    });
  });
}

function stopWirelessServer(): WirelessStatus {
  wsClients.forEach((c) => c.close());
  wsClients.clear();
  wsServer?.close();
  httpServer?.close();
  httpServer = null;
  wsServer = null;
  return { running: false, url: null, qrDataUrl: null };
}

ipcMain.handle(IPC.WIRELESS_START, async () => {
  wirelessStatus = await startWirelessServer();
  return wirelessStatus;
});

ipcMain.handle(IPC.WIRELESS_STOP, () => {
  wirelessStatus = stopWirelessServer();
  return wirelessStatus;
});

ipcMain.handle(IPC.WIRELESS_STATUS, () => wirelessStatus);

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  lastFont = readSettings().fontFamily;
  lastFontColor = readSettings().fontColor;

  // Serves an operator-added image/video straight from disk into the local
  // Electron windows (control preview + projector) by id, e.g.
  // obh-media://<id>. net.fetch() on a file:// URL streams the response —
  // it forwards Range headers too, so video seeking works — rather than
  // reading the whole file into memory up front.
  protocol.handle("obh-media", async (request) => {
    const id = new URL(request.url).hostname;
    const item = readMediaLibrary().find((m) => m.id === id);
    if (!item) return new Response("Not found", { status: 404 });
    try {
      const fileUrl = pathToFileURL(item.filePath).toString();
      return net.fetch(fileUrl, { headers: request.headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  // The control window's voice-command feature needs microphone access.
  // This app has no third-party web content, so auto-granting media
  // permission for its own windows is safe (there's nothing untrusted
  // to accidentally give mic access to).
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  // A wireless HDMI/Miracast dongle connecting or disconnecting mid-session
  // shows up as a display being added/removed — let the control window
  // refresh its list live instead of requiring a manual refresh.
  screen.on("display-added", broadcastDisplaysChanged);
  screen.on("display-removed", broadcastDisplaysChanged);

  createControlWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on("window-all-closed", () => {
  stopWirelessServer();
  if (process.platform !== "darwin") app.quit();
});
