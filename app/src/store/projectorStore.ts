import { create } from "zustand";
import { EMPTY_PROJECTOR_STATE, ProjectorState } from "../shared/types";

interface ProjectorStoreState extends ProjectorState {
  background: string | null;
  fontFamily: string;
  fontColor: string;
  setState: (state: ProjectorState) => void;
  setBackground: (dataUrl: string | null) => void;
  setFontFamily: (font: string) => void;
  setFontColor: (color: string) => void;
}

/**
 * The projector window never decides anything — it only ever displays
 * whatever the control window last broadcast. Keeping this store dumb
 * is what guarantees the two windows can never disagree about what's
 * on screen.
 */
export const useProjectorStore = create<ProjectorStoreState>((set) => ({
  ...EMPTY_PROJECTOR_STATE,
  background: null,
  fontFamily: "Georgia",
  fontColor: "#ffffff",
  setState: (state) => set(state),
  setBackground: (dataUrl) => set({ background: dataUrl }),
  setFontFamily: (font) => set({ fontFamily: font }),
  setFontColor: (color) => set({ fontColor: color }),
}));

let initialized = false;
export function initProjectorBridge() {
  if (initialized) return;
  initialized = true;

  if (typeof window !== "undefined" && window.obh) {
    // Running inside Electron (the local projector window) — use the
    // preload IPC bridge as normal.
    window.obh.onState((state) => {
      useProjectorStore.getState().setState(state);
    });
    window.obh.onBackground((dataUrl) => {
      useProjectorStore.getState().setBackground(dataUrl);
    });
    window.obh.onFont((font) => {
      useProjectorStore.getState().setFontFamily(font);
    });
    window.obh.onFontColor((color) => {
      useProjectorStore.getState().setFontColor(color);
    });
    window.obh.requestState();
    window.obh.requestBackground();
    window.obh.requestFont();
    window.obh.requestFontColor();
    return;
  }

  // No Electron bridge — this is a plain browser (a smart TV or phone
  // that opened the wireless projection link) getting the exact same
  // ProjectorApp bundle over HTTP. Mirror the same state over the
  // WebSocket the main process exposes for wireless clients instead.
  if (typeof window !== "undefined" && "WebSocket" in window) {
    const wsUrl = `${window.location.origin.replace(/^http/, "ws")}/ws`;
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "state") {
          useProjectorStore.getState().setState(msg.payload);
        } else if (msg.type === "background") {
          useProjectorStore.getState().setBackground(msg.payload);
        } else if (msg.type === "font") {
          useProjectorStore.getState().setFontFamily(msg.payload);
        } else if (msg.type === "font-color") {
          useProjectorStore.getState().setFontColor(msg.payload);
        }
      } catch {
        // Ignore malformed messages rather than crashing the display.
      }
    };
  }
}
