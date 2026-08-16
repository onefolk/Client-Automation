New-Item -ItemType Directory -Path "D:\temp" -Force -ErrorAction SilentlyContinue
$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:RUSTUP_HOME = "D:\.rustup"
$env:CARGO_HOME = "D:\.cargo"
[Environment]::SetEnvironmentVariable("TEMP", "D:\temp", "User")
[Environment]::SetEnvironmentVariable("TMP", "D:\temp", "User")
[Environment]::SetEnvironmentVariable("RUSTUP_HOME", "D:\.rustup", "User")
[Environment]::SetEnvironmentVariable("CARGO_HOME", "D:\.cargo", "User")

Write-Host "Installing stable toolchain with temp in D:\temp..."
& "D:\.cargo\bin\rustup.exe" default stable-x86_64-pc-windows-msvc
