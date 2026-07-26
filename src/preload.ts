import { contextBridge, ipcRenderer } from "electron";
import {
  BackgroundGalleryState,
  Hymn,
  IPC,
  ImportedFile,
  ObhBridge,
  ProjectorState,
} from "./shared/types";

const bridge: ObhBridge = {
  openProjector: () => ipcRenderer.invoke(IPC.OPEN_PROJECTOR),
  closeProjector: () => ipcRenderer.invoke(IPC.CLOSE_PROJECTOR),
  toggleFullscreen: () => ipcRenderer.invoke(IPC.TOGGLE_FULLSCREEN),

  sendState: (state: ProjectorState) => {
    ipcRenderer.send(IPC.STATE_UPDATE, state);
  },

  onState: (cb: (state: ProjectorState) => void) => {
    const listener = (_event: unknown, state: ProjectorState) => cb(state);
    ipcRenderer.on(IPC.STATE_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.STATE_UPDATE, listener);
  },

  requestState: () => {
    ipcRenderer.send(IPC.REQUEST_STATE);
  },

  listCustomSongs: () => ipcRenderer.invoke(IPC.SONGS_LIST),
  saveCustomSong: (song: Hymn) => ipcRenderer.invoke(IPC.SONGS_SAVE, song),
  deleteCustomSong: (id: string) => ipcRenderer.invoke(IPC.SONGS_DELETE, id),
  importSongFile: (): Promise<ImportedFile | null> =>
    ipcRenderer.invoke(IPC.SONGS_IMPORT_FILE),

  listBackgroundGallery: (): Promise<BackgroundGalleryState> =>
    ipcRenderer.invoke(IPC.BACKGROUND_GALLERY_LIST),
  addBackgroundImages: (): Promise<BackgroundGalleryState> =>
    ipcRenderer.invoke(IPC.BACKGROUND_GALLERY_ADD),
  removeBackgroundImage: (path: string): Promise<BackgroundGalleryState> =>
    ipcRenderer.invoke(IPC.BACKGROUND_GALLERY_REMOVE, path),
  setActiveBackground: (path: string) =>
    ipcRenderer.invoke(IPC.BACKGROUND_GALLERY_SET_ACTIVE, path),
  clearActiveBackground: (): Promise<BackgroundGalleryState> =>
    ipcRenderer.invoke(IPC.BACKGROUND_GALLERY_CLEAR_ACTIVE),
  loadBackgroundImage: () => ipcRenderer.invoke(IPC.BACKGROUND_LOAD),
  sendBackground: (dataUrl: string | null) => {
    ipcRenderer.send(IPC.BACKGROUND_UPDATE, dataUrl);
  },
  onBackground: (cb: (dataUrl: string | null) => void) => {
    const listener = (_event: unknown, dataUrl: string | null) => cb(dataUrl);
    ipcRenderer.on(IPC.BACKGROUND_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC.BACKGROUND_UPDATE, listener);
  },
  requestBackground: () => {
    ipcRenderer.send(IPC.BACKGROUND_REQUEST);
  },
};

contextBridge.exposeInMainWorld("obh", bridge);
