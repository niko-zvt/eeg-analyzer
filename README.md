# EEG BDF Analyzer

Desktop application for viewing and analyzing EEG recordings in **BDF** and **EDF** formats.

**Frontend:** Electron + React + TypeScript + Tailwind + Canvas2D  
**Backend:** Python (FastAPI + MNE)

## Features

- Open **BDF** and **EDF** files via MNE
- Multi-channel waveform viewer with time navigation and amplitude scaling
- Multi-resolution display pyramid for long recordings
- **Zones of interest** with epoch splitting (duration or count)
- Spectral analysis (PSD) for standard bands or custom frequency ranges
- Filters (high-pass, low-pass, notch) with undo/redo for zones
- Save markup to JSON sidecar files (`<recording>.zones.json`)

## Requirements

- Python 3.11+
- Node.js 20+ (18+ may work for dev)
- macOS / Windows / Linux

### Python dependency files

| File | When to use |
|------|-------------|
| [`requirements.txt`](requirements.txt) | **Runtime only** — enough to run the API (`npm run dev`, `uvicorn`). |
| [`requirements-dev.txt`](requirements-dev.txt) | **Development + packaging** — includes runtime, Matplotlib for examples, and PyInstaller to build installers. |

## Installation

```bash
cd /path/to/eeg-analyzer

# Python backend (full dev setup)
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# Electron frontend
cd electron
npm install
cd ..
```

## Run (development)

```bash
source .venv/bin/activate
cd electron
npm run dev
```

Electron starts the Python API at `http://127.0.0.1:8756` and loads the Vite dev server at port **5173**. Use the **Electron window** for file dialogs and full functionality (not the browser tab alone).

### Backend only (API debugging)

```bash
source .venv/bin/activate
uvicorn server.main:app --host 127.0.0.1 --port 8756 --reload
```

## Controls

| Action | Shortcut / gesture |
|--------|-------------------|
| Horizontal time scroll | Mouse wheel |
| Time zoom | Ctrl/Cmd + wheel |
| Reset view | Toolbar or menu |
| Undo / redo (zones) | Ctrl+Z / Ctrl+Y (where available) |
| Delete zone / center on zone | Delete / Space (when a zone is selected) |

## Project layout

```
eeg-analyzer/
├── server/              # FastAPI backend
├── Source/App/core/     # Python core (MNE, filters, spectra)
├── Source/App/models/   # Session and zone models
└── electron/            # Electron + React UI
    ├── electron/        # main process + preload
    └── src/             # React components
```

## Project files

Zone markup is stored in `<recording_name>.zones.json` next to the recording file (same basename, `.zones.json` suffix).

## Releases

Pre-built installers for **macOS**, **Windows**, and **Linux** are published on **GitHub Releases** when a version tag (`v*`) is pushed. CI builds:

| Platform | Artifacts |
|----------|-----------|
| macOS | `.dmg`, `.zip` |
| Windows | NSIS installer (`.exe`) |
| Linux | `.AppImage` |

Unsigned builds may show a security prompt on first launch until code-signing certificates are configured in repository secrets.

## Build installers locally

Local packaging only targets the **current operating system**. You need Python 3.11+, Node.js 20+, and build tools (NSIS on Windows, optional on Linux).

```bash
./scripts/release/build.sh          # macOS / Linux
# scripts\release\build.ps1         # Windows PowerShell
```

Output: `electron/release/`

Manual steps:

```bash
# 1. Python backend bundle (PyInstaller onedir)
pip install -r requirements-dev.txt
./packaging/build_backend.sh

# 2. Electron app
cd electron
npm ci
npm run build
npm run dist:mac    # or dist:win / dist:linux
```

The packaged app runs a bundled API from `resources/backend/` (no `.venv` required).

## CI

- **`.github/workflows/release.yml`** — cross-platform release builds on tag `v*`.
- **`.github/workflows/ci.yml`** — lightweight checks on pull requests (TypeScript + Python import smoke test).

Optional signing (later): set GitHub secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `MACOS_CERT_*`, `WINDOWS_CERT_*` for electron-builder.
