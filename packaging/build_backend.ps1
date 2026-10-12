$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".venv")) {
  py -3.11 -m venv .venv
}
& .\.venv\Scripts\Activate.ps1

pip install -q -r requirements.txt -r requirements-build.txt
pyinstaller --noconfirm --clean `
  --distpath packaging/dist `
  --workpath packaging/build `
  packaging/backend.spec

$Out = Join-Path $Root "packaging\dist\eeg-backend"
if (-not (Test-Path $Out)) {
  throw "Expected output directory not found: $Out"
}

Write-Host "Backend bundle ready: $Out"
