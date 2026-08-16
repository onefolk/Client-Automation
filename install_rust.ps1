$env:RUSTUP_HOME = "D:\.rustup"
$env:CARGO_HOME = "D:\.cargo"
[Environment]::SetEnvironmentVariable("RUSTUP_HOME", "D:\.rustup", "User")
[Environment]::SetEnvironmentVariable("CARGO_HOME", "D:\.cargo", "User")

Write-Host "Downloading rustup-init..."
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "D:\rustup-init.exe"
Write-Host "Running rustup-init..."
Start-Process -FilePath "D:\rustup-init.exe" -ArgumentList "-y --default-host x86_64-pc-windows-msvc" -Wait
Remove-Item "D:\rustup-init.exe" -Force -ErrorAction SilentlyContinue
Write-Host "Rustup installation completed!"
