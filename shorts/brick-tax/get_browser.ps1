# Downloads and unpacks the render browser with Windows' own tools (avoids the "spawn EFTYPE" error).
param([switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root 'node_modules\.remotion\chrome-headless-shell\win64'
$exe = Join-Path $dir 'chrome-headless-shell-win64\chrome-headless-shell.exe'
$ok = Join-Path $dir 'unpacked_ok.txt'
if ((Test-Path $exe) -and (Test-Path $ok) -and -not $Force) { Write-Host 'Render browser is ready.'; exit 0 }
$url = 'https://storage.googleapis.com/chrome-for-testing-public/123.0.6312.86/win64/chrome-headless-shell-win64.zip'
$zip = Join-Path $root 'out\chrome-headless-shell-win64.zip'
New-Item -ItemType Directory -Force -Path (Join-Path $root 'out') | Out-Null
Write-Host 'Downloading the render browser (about 90 MB)...'
if (Get-Command curl.exe -ErrorAction SilentlyContinue) { & curl.exe -L --fail -o $zip $url } else { Invoke-WebRequest -Uri $url -OutFile $zip }
if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 10MB) { throw 'Download failed. Check your internet connection and try again.' }
if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Write-Host 'Unpacking...'
Expand-Archive -Path $zip -DestinationPath $dir -Force
Remove-Item -Force $zip
if (-not (Test-Path $exe)) { throw 'Unpacking failed: chrome-headless-shell.exe not found.' }
Set-Content -Path $ok -Value 'ok'
Write-Host ('Render browser ready: {0:N0} MB' -f ((Get-Item $exe).Length / 1MB))
