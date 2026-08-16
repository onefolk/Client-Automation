$env:TEMP = "D:\temp"
$env:TMP = "D:\temp"
$env:RUSTUP_HOME = "D:\.rustup"
$env:CARGO_HOME = "D:\.cargo"
$env:CARGO_TARGET_DIR = "D:\Onefolk-Client-Intelligence\target"
$env:PATH = "D:\.cargo\bin;" + $env:PATH
& "D:\.cargo\bin\cargo.exe" @args
