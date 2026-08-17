$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:RUSTUP_HOME = "D:\.rustup"
$env:CARGO_HOME = "D:\.cargo"
$env:CARGO_TARGET_DIR = "D:\Onefolk-Client-Intelligence\target"
$env:PATH = "D:\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained;D:\.cargo\bin;" + $env:PATH
& "D:\.cargo\bin\cargo.exe" @args
