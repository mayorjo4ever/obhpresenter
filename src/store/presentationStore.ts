import { create } from "zustand";
import { DisplayMode, Hymn, MediaItem, NoteItem, PresentationItem, ProjectorState } from "../shared/types";
import { buildHymnItem, buildMediaItem, buildNoteItem, PresentationCursor } from "../engine/presentationEngine";

interface PresentationState {
  displayMode: DisplayMode;
  item: PresentationItem | null;
  cursor: PresentationCursor | null;
  isBlank: boolean;
  isLive: boolean;
  background: string | null;
  /** Projector text font — Georgia by default, but the operator can pick
   * from a curated list of Windows-safe fonts (Tahoma, Arial, etc.). */
  fontFamily: string;
  /** Projector text color — white by default, adjustable for contrast
   * against whatever background image is active. */
  fontColor: string;
  /** When true (default), verses longer than ~16 words split into
   * sequential ~2-line screens. When false, a verse always shows as one
   * slide (auto-shrunk to fit by FitText). Applies to content loaded
   * after the toggle changes — it doesn't retroactively rebuild whatever
   * is currently on screen, so switching mid-service can't yank the
   * live display back to the start of a verse. */
  splitLongVerses: boolean;

  setDisplayMode: (mode: DisplayMode) => void;
  loadHymn: (hymn: Hymn) => void;
  loadMedia: (media: MediaItem, loop?: boolean) => void;
  loadNote: (note: NoteItem) => void;
  loadItem: (item: PresentationItem) => void;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  toggleBlank: () => void;
  goLive: () => void;
  stopLive: () => void;
  setBackground: (dataUrl: string | null) => void;
  setFontFamily: (font: string) => void;
  setFontColor: (color: string) => void;
  setSplitLongVerses: (value: boolean) => void;
}

/** Push current state to the projector window via the preload bridge.
 * No-op outside Electron (e.g. quick UI iteration in a plain browser). */
function broadcast(state: ProjectorState) {
  window.obh?.sendState(state);
}

function toProjectorState(s: {
  item: PresentationItem | null;
  cursor: PresentationCursor | null;
  isBlank: boolean;
  isLive: boolean;
}): ProjectorState {
  return {
    item: s.item,
    currentSlideIndex: s.cursor?.index ?? 0,
    isBlank: s.isBlank,
    isLive: s.isLive,
  };
}

let lastLoggedItemId: string | null = null;

function buildLogTitle(item: PresentationItem): string {
  if (item.type === "note") {
    const firstLine = item.slides[0]?.lines[0];
    return firstLine ? `${item.title}: ${firstLine}` : item.title;
  }
  return item.title;
}

/** Logs an item the moment it's actually visible to the congregation —
 * called both when freshly going live, and when switching items while
 * already live (the common case: go live once at service start, then
 * just click through hymns/verses/notes without pressing "Go Live"
 * again each time). Skips duplicate consecutive entries for the same
 * item either way. */
function maybeLogItem(item: PresentationItem | null) {
  if (item && item.id !== lastLoggedItemId) {
    lastLoggedItemId = item.id;
    window.obh?.appendLog({ type: item.type, title: buildLogTitle(item) });
  }
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  displayMode: "verse",
  item: null,
  cursor: null,
  isBlank: false,
  isLive: false,
  background: null,
  fontFamily: "Georgia",
  fontColor: "#ffffff",
  splitLongVerses: true,

  setDisplayMode: (mode) => set({ displayMode: mode }),

  loadHymn: (hymn) => {
    const item = buildHymnItem(hymn, get().displayMode, get().splitLongVerses);
    get().loadItem(item);
  },

  loadMedia: (media, loop = true) => {
    get().loadItem(buildMediaItem(media, loop));
  },

  loadNote: (note) => {
    get().loadItem(buildNoteItem(note));
  },

  loadItem: (item) => {
    const cursor = new PresentationCursor(item, 0);
    set({ item, cursor, isBlank: false });
    if (get().isLive) {
      broadcast(toProjectorState({ ...get(), item, cursor, isBlank: false }));
      maybeLogItem(item);
    }
  },

  next: () => {
    const { cursor } = get();
    if (!cursor) return;
    const nextCursor = cursor.next();
    set({ cursor: nextCursor });
    if (get().isLive) broadcast(toProjectorState({ ...get(), cursor: nextCursor }));
  },

  previous: () => {
    const { cursor } = get();
    if (!cursor) return;
    const prevCursor = cursor.previous();
    set({ cursor: prevCursor });
    if (get().isLive) broadcast(toProjectorState({ ...get(), cursor: prevCursor }));
  },

  goTo: (index) => {
    const { cursor } = get();
    if (!cursor) return;
    const gone = cursor.goTo(index);
    set({ cursor: gone });
    if (get().isLive) broadcast(toProjectorState({ ...get(), cursor: gone }));
  },

  toggleBlank: () => {
    const isBlank = !get().isBlank;
    set({ isBlank });
    if (get().isLive) broadcast(toProjectorState({ ...get(), isBlank }));
  },

  goLive: () => {
    // Going live always guarantees the projector actually shows something —
    // otherwise a stale isBlank:true from before could leave it dark even
    // though the operator just pressed "Go Live".
    set({ isLive: true, isBlank: false });
    broadcast(toProjectorState({ ...get(), isLive: true, isBlank: false }));

    // Log the moment something is actually shown to the congregation —
    // not every "Go Live" click (pressing it again to un-blank the same
    // item shouldn't create a second entry for it).
    const item = get().item;
    if (item && item.id !== lastLoggedItemId) {
      lastLoggedItemId = item.id;
      window.obh?.appendLog({ type: item.type, title: buildLogTitle(item) });
    }
  },

  stopLive: () => {
    set({ isLive: false });
    broadcast(toProjectorState({ ...get(), isLive: false }));
  },

  setBackground: (dataUrl) => {
    set({ background: dataUrl });
    window.obh?.sendBackground(dataUrl);
  },

  setFontFamily: (font) => {
    set({ fontFamily: font });
    window.obh?.sendFont(font);
  },

  setFontColor: (color) => {
    set({ fontColor: color });
    window.obh?.sendFontColor(color);
  },

  setSplitLongVerses: (value) => set({ splitLongVerses: value }),
}));
