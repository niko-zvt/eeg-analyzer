import { Menu } from "electron";
import { getStrings, type Locale } from "../shared/i18n";

export function buildAppMenu(
  locale: Locale,
  sendMenuAction: (action: string) => void,
): void {
  const t = getStrings(locale);
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.menuFile,
      submenu: [
        {
          label: t.menuOpenBdf,
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("open-bdf"),
        },
        {
          label: t.menuOpenProject,
          click: () => sendMenuAction("open-project"),
        },
        {
          label: t.menuSaveProject,
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save-project"),
        },
        { type: "separator" },
        {
          label: t.menuExit,
          accelerator: "CmdOrCtrl+Q",
          role: "quit",
        },
      ],
    },
    {
      label: t.menuEdit,
      submenu: [
        {
          label: t.menuUndo,
          accelerator: "CmdOrCtrl+Z",
          click: () => sendMenuAction("undo"),
        },
        {
          label: t.menuRedo,
          accelerator: "CmdOrCtrl+Y",
          click: () => sendMenuAction("redo"),
        },
      ],
    },
    {
      label: t.menuView,
      submenu: [
        {
          label: t.menuResetView,
          click: () => sendMenuAction("reset-view"),
        },
        {
          label: t.menuShowAll,
          click: () => sendMenuAction("show-all"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
