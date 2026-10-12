import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from "electron";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { buildAppMenu } from "./menu";
import { isLocale, type Locale } from "../shared/i18n";

// Prevent macOS trackpad horizontal swipe from hijacking wheel events as back/forward navigation.
app.commandLine.appendSwitch(
  "disable-features",
  "OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation",
);

const API_PORT = 8756;
const API_BASE = `http://127.0.0.1:${API_PORT}`;
const VITE_DEV_URL = "http://127.0.0.1:5173";

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcess | null = null;
let currentLocale: Locale = "en";

function repoRoot(): string {
  return path.resolve(app.getAppPath(), "..");
}

function backendBundleDir(): string {
  return path.join(process.resourcesPath, "backend");
}

function bundledBackendExecutable(): string {
  const name = process.platform === "win32" ? "eeg-backend.exe" : "eeg-backend";
  return path.join(backendBundleDir(), name);
}

function devPythonExecutable(): string {
  const root = repoRoot();
  const venvPython =
    process.platform === "win32"
      ? path.join(root, ".venv", "Scripts", "python.exe")
      : path.join(root, ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;
  return process.platform === "win32" ? "python" : "python3";
}

function backendLogPath(): string {
  return path.join(app.getPath("userData"), "backend.log");
}

function probeUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(
        res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500,
      );
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeUrl(`${API_BASE}/api/health`)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Python backend did not start in time");
}

function startPythonBackend(): void {
  const packaged = app.isPackaged;
  const cwd = packaged ? backendBundleDir() : repoRoot();
  const logPath = backendLogPath();
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  if (packaged) {
    const exe = bundledBackendExecutable();
    if (!fs.existsSync(exe)) {
      console.error("Bundled backend not found:", exe);
    }
    pythonProcess = spawn(exe, [], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
  } else {
    pythonProcess = spawn(
      devPythonExecutable(),
      ["-m", "uvicorn", "server.main:app", "--host", "127.0.0.1", "--port", String(API_PORT)],
      {
        cwd,
        stdio: "inherit",
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      },
    );
  }

  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python backend:", err);
  });

  if (packaged && pythonProcess.stdout && pythonProcess.stderr) {
    pythonProcess.stdout.pipe(logStream);
    pythonProcess.stderr.pipe(logStream);
  }
}

function stopPythonBackend(): void {
  if (pythonProcess && !pythonProcess.killed) {
    if (process.platform === "win32") {
      pythonProcess.kill();
    } else {
      pythonProcess.kill("SIGTERM");
    }
  }
  pythonProcess = null;
}

async function ensureBackendRunning(): Promise<void> {
  if (pythonProcess && !pythonProcess.killed) {
    if (await probeUrl(`${API_BASE}/api/health`)) return;
    stopPythonBackend();
  }
  startPythonBackend();
  await waitForHealth();
}

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send("menu-action", action);
}

async function waitForVite(timeoutMs = 15000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeUrl(VITE_DEV_URL)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Vite dev server not reachable at ${VITE_DEV_URL}`);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#2b2b2b",
    title: "EEG BDF Analyzer",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const devMode = !app.isPackaged;
  try {
    if (devMode) {
      await waitForVite();
      await mainWindow.loadURL(VITE_DEV_URL);
      if (process.env.ELECTRON_DEVTOOLS === "1") {
        mainWindow.webContents.openDevTools({ mode: "detach" });
      }
    } else {
      await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  } catch (err) {
    dialog.showErrorBox("UI Error", String(err));
    app.quit();
  }
}

app.whenReady().then(async () => {
  buildAppMenu(currentLocale, sendMenuAction);
  try {
    await ensureBackendRunning();
    await createWindow();
  } catch (err) {
    dialog.showErrorBox("Backend Error", String(err));
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopPythonBackend();
  app.quit();
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await ensureBackendRunning();
      await createWindow();
    } catch (err) {
      dialog.showErrorBox("Backend Error", String(err));
    }
  }
});

app.on("before-quit", () => {
  stopPythonBackend();
});

ipcMain.handle("open-file-dialog", async (_event, filters?: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters:
      filters ?? [
        { name: "EEG", extensions: ["bdf", "edf"] },
        { name: "All", extensions: ["*"] },
      ],
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("open-project-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      { name: "Project", extensions: ["json"] },
      { name: "All", extensions: ["*"] },
    ],
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle("get-api-base-url", () => API_BASE);

ipcMain.handle("set-locale", (_event, locale: string) => {
  if (isLocale(locale)) {
    currentLocale = locale;
    buildAppMenu(currentLocale, sendMenuAction);
  }
  return currentLocale;
});

ipcMain.handle("show-item-in-folder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});
