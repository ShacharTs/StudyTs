"""
Setup script for local browser_qa virtual environment and playwright chromium browser.
"""
import sys
import subprocess
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / ".venv"

def get_venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"

def main():
    print(f"[*] Setting up virtual environment at {VENV_DIR}...")
    if not VENV_DIR.exists():
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])

    py_exe = get_venv_python()
    if not py_exe.exists():
        print(f"[!] Error: Virtualenv Python executable not found at {py_exe}")
        sys.exit(1)

    print("[*] Upgrading pip and installing requirements...")
    req_file = BASE_DIR / "requirements.txt"
    subprocess.check_call([str(py_exe), "-m", "pip", "install", "--upgrade", "pip"])
    subprocess.check_call([str(py_exe), "-m", "pip", "install", "-r", str(req_file)])

    print("[*] Installing Playwright Chromium browser...")
    subprocess.check_call([str(py_exe), "-m", "playwright", "install", "chromium"])

    print("[+] Browser QA environment setup complete.")

if __name__ == "__main__":
    main()
