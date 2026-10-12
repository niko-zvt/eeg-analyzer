/// <reference types="vite/client" />

import type { MenuAction } from "../electron/preload";

interface ElectronAPI {
  openFileDialog: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  openProjectDialog: () => Promise<string | null>;
  getApiBaseUrl: () => Promise<string>;
  setLocale: (locale: string) => Promise<string>;
  showItemInFolder: (filePath: string) => Promise<void>;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
