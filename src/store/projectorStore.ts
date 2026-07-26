import { create } from "zustand";
import { EMPTY_PROJECTOR_STATE, ProjectorState } from "../shared/types";

interface ProjectorStoreState extends ProjectorState {
  background: string | null;
  setState: (state: ProjectorState) => void;
  setBackground: (dataUrl: string | null) => void;
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
  setState: (state) => set(state),
  setBackground: (dataUrl) => set({ background: dataUrl }),
}));

let initialized = false;
export function initProjectorBridge() {
  if (initialized) return;
  initialized = true;
  window.obh?.onState((state) => {
    useProjectorStore.getState().setState(state);
  });
  window.obh?.onBackground((dataUrl) => {
    useProjectorStore.getState().setBackground(dataUrl);
  });
  window.obh?.requestState();
  window.obh?.requestBackground();
}
