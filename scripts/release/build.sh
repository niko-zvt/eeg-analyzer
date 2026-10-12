#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

chmod +x packaging/build_backend.sh
./packaging/build_backend.sh

cd "$ROOT/electron"
npm ci
npm run build

case "$(uname -s)" in
  Darwin) npm run dist:mac ;;
  Linux) npm run dist:linux ;;
  *)
    echo "Unsupported OS for local packaging: $(uname -s)" >&2
    exit 1
    ;;
esac

echo "Installers written to: $ROOT/electron/release/"
