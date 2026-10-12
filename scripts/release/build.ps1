$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

& .\packaging\build_backend.ps1

Set-Location (Join-Path $Root "electron")
npm ci
npm run build
npm run dist:win

Write-Host "Installers written to: $(Join-Path $Root 'electron\release')"
