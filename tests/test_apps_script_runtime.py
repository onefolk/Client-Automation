import subprocess

def test_shipped_apps_script_runtime():
    subprocess.run(['node','tests/apps_script_runtime.cjs'],check=True,capture_output=True,text=True)
