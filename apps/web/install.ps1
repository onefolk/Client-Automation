$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:BUN_INSTALL_CACHE_DIR = "D:\temp\bun-cache"
New-Item -ItemType Directory -Path "D:\temp\bun-cache" -Force -ErrorAction SilentlyContinue

Write-Host "Installing dependencies with bun..."
bun install --cache-dir "D:\temp\bun-cache"
