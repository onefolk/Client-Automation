$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:RUSTUP_HOME = "D:\.rustup"
$env:CARGO_HOME = "D:\.cargo"

Write-Host "Installing stable-x86_64-pc-windows-gnu toolchain..."
& "D:\.cargo\bin\rustup.exe" toolchain install stable-x86_64-pc-windows-gnu
& "D:\.cargo\bin\rustup.exe" default stable-x86_64-pc-windows-gnu
