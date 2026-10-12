"""PyInstaller entry point for the bundled FastAPI backend."""

from __future__ import annotations

import sys
from pathlib import Path

def _import_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path.cwd()))
    return Path(__file__).resolve().parent.parent


ROOT = _import_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> None:
    import uvicorn

    uvicorn.run(
        "server.main:app",
        host="127.0.0.1",
        port=8756,
        log_level="info",
    )


if __name__ == "__main__":
    main()
