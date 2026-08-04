/**
 * Shared types — imported by main process, preload, control renderer,
 * and projector renderer. No Electron or React imports allowed here.
 */

// ---------- Content (source data) ----------

export interface HymnBlock {
  /** A verse number (1, 2, 3...) or "CHORUS" */
  chapter: number | string;
  verses: string[];
}

export interface Hymn {
  id: number | string;
  title: string;
  piano?: string;
  scripture?: string;
  chapters: HymnBlock[];
  /** "library" = shipped hymnal, "custom" = imported/added by the operator */
  source?: "library" | "custom";
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleReference {
  book: string;
  chapter: number;
  /** inclusive range, e.g. verse 16 or verses 16-18 */
  startVerse: number;
  endVerse: number;
}

// ---------- Presentation (derived at runtime) ----------

export type SlideKind = "hymn-line" | "hymn-verse" | "bible-verse" | "note" | "blank";

export interface Slide {
  id: string;
  kind: SlideKind;
  /** Main text shown on the projector for this slide */
  lines: string[];
  /** e.g. "Verse 2", "Chorus", "John 3:16" */
  label: string;
  /** index of this slide within its parent PresentationItem */
  index: number;
}

export type DisplayMode = "verse" | "line";

export interface PresentationItem {
  id: string;
  type: "hymn" | "bible" | "media" | "note";
  title: string;
  slides: Slide[];
  /** Only present when type === "media" — the hymn/bible slide machinery
   * (cursor, prev/next, live preview thumbnails) still works unchanged
   * because a media item always carries exactly one synthetic slide. */
  media?: MediaRef;
}

export interface MediaRef {
  id: string;
  kind: "image" | "video";
  loop: boolean;
}

// ---------- Media library (images/videos for full-screen projection) ----------

export interface MediaItem {
  id: string;
  name: string;
  filePath: string;
  kind: "image" | "video";
}

export interface MediaLibraryState {
  items: MediaItem[];
}

// ---------- Notes (topics, announcements, news — free-text projectable slides) ----------

export interface NoteItem {
  id: string;
  /** Short category label shown as the projector heading — "Topic",
   * "Announcement", "News", or anything the operator types. */
  title: string;
  /** The actual projected text — can be multi-line; long notes auto-split
   * across slides the same way long hymn verses do. */
  body: string;
}

export interface NoteLibraryState {
  items: NoteItem[];
}

// ---------- Service log (a running record of everything shown, like
// EasyWorship's presentation history — exportable to a text file) ----------

export interface LogEntry {
  id: string;
  /** Epoch milliseconds. */
  timestamp: number;
  type: "hymn" | "bible" | "note" | "media";
  /** Human-readable line for this entry, e.g. "Hymn 42 — Blessed
   * Assurance", "John 3:16", "Topic: The Greatest Battle Ever Fought". */
  title: string;
}

/** What the control window broadcasts and the projector mirrors */
export interface ProjectorState {
  item: PresentationItem | null;
  currentSlideIndex: number;
  isBlank: boolean;
  isLive: boolean;
}

export const EMPTY_PROJECTOR_STATE: ProjectorState = {
  item: null,
  currentSlideIndex: 0,
  isBlank: false,
  isLive: false,
};

// ---------- IPC contract ----------
// Single source of truth for channel names + payload shapes so main,
// preload, and renderers can't silently drift apart.

// Curated, presentation-friendly fonts that ship with Windows by default —
// no font files need to be bundled, since Tahoma/Arial/Verdana/etc. are
// already on every target machine.
export const PROJECTOR_FONTS = [
  "Georgia",
  "Tahoma",
  "Arial",
  "Verdana",
  "Calibri",
  "Segoe UI",
  "Times New Roman",
  "Trebuchet MS",
  "Century Gothic",
  "Franklin Gothic Medium",
] as const;

export const PROJECTOR_TEXT_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#000000" },
  { name: "Gold", value: "#e0bf66" },
  { name: "Ivory", value: "#f5f0e1" },
  { name: "Sky Blue", value: "#7ec8f5" },
  { name: "Yellow", value: "#f5d547" },
  { name: "Light Gray", value: "#d9d9d9" },
] as const;

export const IPC = {
  OPEN_PROJECTOR: "projector:open",
  CLOSE_PROJECTOR: "projector:close",
  TOGGLE_FULLSCREEN: "projector:toggle-fullscreen",
  PROJECTOR_READY: "projector:ready",
  STATE_UPDATE: "projector:state-update",
  REQUEST_STATE: "projector:request-state",
  SONGS_LIST: "songs:list",
  SONGS_SAVE: "songs:save",
  SONGS_DELETE: "songs:delete",
  SONGS_IMPORT_FILE: "songs:import-file",
  BACKGROUND_GALLERY_LIST: "background:gallery-list",
  BACKGROUND_GALLERY_ADD: "background:gallery-add",
  BACKGROUND_GALLERY_REMOVE: "background:gallery-remove",
  BACKGROUND_GALLERY_SET_ACTIVE: "background:gallery-set-active",
  BACKGROUND_GALLERY_CLEAR_ACTIVE: "background:gallery-clear-active",
  BACKGROUND_LOAD: "background:load",
  BACKGROUND_UPDATE: "background:update",
  BACKGROUND_REQUEST: "background:request",
  SCREEN_LIST: "screen:list",
  SCREEN_USE: "screen:use",
  SCREEN_CHANGED: "screen:changed",
  WIRELESS_START: "wireless:start",
  WIRELESS_STOP: "wireless:stop",
  WIRELESS_STATUS: "wireless:status",
  MEDIA_LIST: "media:list",
  MEDIA_ADD: "media:add",
  MEDIA_REMOVE: "media:remove",
  FONT_LOAD: "font:load",
  FONT_UPDATE: "font:update",
  FONT_REQUEST: "font:request",
  FONT_COLOR_LOAD: "font-color:load",
  FONT_COLOR_UPDATE: "font-color:update",
  FONT_COLOR_REQUEST: "font-color:request",
  NOTE_LIST: "note:list",
  NOTE_SAVE: "note:save",
  NOTE_REMOVE: "note:remove",
  LOG_LIST: "log:list",
  LOG_APPEND: "log:append",
  LOG_EXPORT: "log:export",
  LOG_CLEAR: "log:clear",
} as const;

export interface ImportedFile {
  filename: string;
  content: string;
}

export interface BackgroundImageMeta {
  path: string;
  /** Small resized preview used in the gallery grid — the full-resolution
   * image is only read when an image is actually set as the active one. */
  thumbnail: string;
}

export interface BackgroundGalleryState {
  images: BackgroundImageMeta[];
  activePath: string | null;
}

export interface DisplayInfo {
  id: number;
  label: string;
  width: number;
  height: number;
  /** true for the primary/built-in display (usually the laptop's own screen) */
  isPrimary: boolean;
  /** the display currently selected as the projector target */
  isSelected: boolean;
}

export interface WirelessStatus {
  running: boolean;
  url: string | null;
  qrDataUrl: string | null;
  error?: string;
}

export interface ObhBridge {
  openProjector: () => Promise<void>;
  closeProjector: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  /** Control window -> main -> projector window */
  sendState: (state: ProjectorState) => void;
  /** Projector window subscribes to state pushed from main */
  onState: (cb: (state: ProjectorState) => void) => () => void;
  /** Projector window asks main to resend the last known state (on load) */
  requestState: () => void;

  /** Custom/"special" songs, persisted to disk in the userData folder */
  listCustomSongs: () => Promise<Hymn[]>;
  saveCustomSong: (song: Hymn) => Promise<Hymn[]>;
  deleteCustomSong: (id: string) => Promise<Hymn[]>;
  /** Opens a native file picker, returns the raw file text for parsing */
  importSongFile: () => Promise<ImportedFile | null>;

  /** Background image gallery — a saved collection of images, any one of
   * which can be set as the projector's active default background.
   * Rendering values are base64 data URLs — safe regardless of the page's
   * origin, unlike raw file:// paths which the dev server's http origin
   * can't load. */
  listBackgroundGallery: () => Promise<BackgroundGalleryState>;
  addBackgroundImages: () => Promise<BackgroundGalleryState>;
  removeBackgroundImage: (path: string) => Promise<BackgroundGalleryState>;
  setActiveBackground: (path: string) => Promise<string | null>;
  clearActiveBackground: () => Promise<BackgroundGalleryState>;
  /** On startup, fetches the currently-active background's full image data */
  loadBackgroundImage: () => Promise<string | null>;
  /** Pushes the active background to the projector window, on its own
   * channel so a multi-MB image isn't resent on every slide navigation. */
  sendBackground: (dataUrl: string | null) => void;
  onBackground: (cb: (dataUrl: string | null) => void) => () => void;
  requestBackground: () => void;

  /** Connected displays — a wireless HDMI/Miracast dongle shows up here
   * exactly like a wired monitor, since Windows/macOS treat it as a
   * regular extended display. */
  listDisplays: () => Promise<DisplayInfo[]>;
  useDisplay: (id: number) => Promise<DisplayInfo[]>;
  onDisplaysChanged: (cb: (displays: DisplayInfo[]) => void) => () => void;

  /** Network projection — no dongle required. Serves the projector view
   * over the local WiFi network so any device with a browser (smart TV,
   * phone, tablet) can open a URL and see the live feed. */
  startWirelessDisplay: () => Promise<WirelessStatus>;
  stopWirelessDisplay: () => Promise<WirelessStatus>;
  getWirelessStatus: () => Promise<WirelessStatus>;

  /** Media library — images/videos the operator has added, each
   * projectable full-screen in place of a hymn/Bible slide. The actual
   * file bytes are streamed on demand (via a custom obh-media:// protocol
   * locally, or a /media/ route on the wireless server for remote
   * viewers) rather than loaded into memory here — videos can be large. */
  listMedia: () => Promise<MediaLibraryState>;
  addMedia: () => Promise<MediaLibraryState>;
  removeMedia: (id: string) => Promise<MediaLibraryState>;

  /** Projector text font — persisted, and pushed live to the projector
   * (and any wireless viewers) the moment the operator changes it. */
  loadFont: () => Promise<string>;
  sendFont: (font: string) => void;
  onFont: (cb: (font: string) => void) => () => void;
  requestFont: () => void;

  /** Projector text color — same live/persisted pattern as the font,
   * so the operator can pick a color that stays readable against
   * whatever background image is in use. */
  loadFontColor: () => Promise<string>;
  sendFontColor: (color: string) => void;
  onFontColor: (cb: (color: string) => void) => () => void;
  requestFontColor: () => void;

  /** Notes library — reusable Topic/Announcement/News-style text slides. */
  listNotes: () => Promise<NoteLibraryState>;
  saveNote: (note: { id?: string; title: string; body: string }) => Promise<NoteLibraryState>;
  removeNote: (id: string) => Promise<NoteLibraryState>;

  /** Service log — a running record of every hymn, Bible passage, note,
   * and media item shown, like EasyWorship's presentation history.
   * appendLog is fire-and-forget; the main process assigns the id/timestamp. */
  listLog: () => Promise<LogEntry[]>;
  appendLog: (entry: { type: LogEntry["type"]; title: string }) => void;
  exportLog: () => Promise<{ saved: boolean; filePath: string | null }>;
  clearLog: () => Promise<LogEntry[]>;
}

declare global {
  interface Window {
    obh: ObhBridge;
  }
}
