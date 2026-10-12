#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  python3.11 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

pip install -q -r requirements.txt -r requirements-build.txt

pyinstaller --noconfirm --clean \
  --distpath packaging/dist \
  --workpath packaging/build \
  packaging/backend.spec

OUT="$ROOT/packaging/dist/eeg-backend"
if [[ ! -d "$OUT" ]]; then
  echo "Expected output directory not found: $OUT" >&2
  exit 1
fi

echo "Backend bundle ready: $OUT"
