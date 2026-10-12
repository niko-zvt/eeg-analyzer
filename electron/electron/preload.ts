import { contextBridge, ipcRenderer } from "electron";

export type MenuAction =
  | "open-bdf"
  | "open-project"
  | "save-project"
  | "undo"
  | "redo"
  | "reset-view"
  | "show-all";

contextBridge.exposeInMainWorld("electronAPI", {
  openFileDialog: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke("open-file-dialog", filters),
  openProjectDialog: () => ipcRenderer.invoke("open-project-dialog"),
  getApiBaseUrl: () => ipcRenderer.invoke("get-api-base-url") as Promise<string>,
  setLocale: (locale: string) =>
    ipcRenderer.invoke("set-locale", locale) as Promise<string>,
  showItemInFolder: (filePath: string) =>
    ipcRenderer.invoke("show-item-in-folder", filePath),
  onMenuAction: (callback: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) =>
      callback(action);
    ipcRenderer.on("menu-action", listener);
    return () => ipcRenderer.removeListener("menu-action", listener);
  },
});
