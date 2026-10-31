#!/usr/bin/env bash
# RolePilot Render Build Script
# Ensures Python dependencies and Playwright Chromium headless binaries/system libs are installed hermetically.

set -euo pipefail

# Crucial for Render native Python: Install browsers inside virtualenv site-packages
# so they are persisted across from the build container to the runtime container.
export PLAYWRIGHT_BROWSERS_PATH=0

echo "=== [RolePilot] 1/3: Installing Python dependencies via active interpreter ==="
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -e . "uvicorn[standard]"

echo "=== [RolePilot] 2/3: Installing Playwright Chromium & system libraries (PLAYWRIGHT_BROWSERS_PATH=0) ==="
python -m playwright install --with-deps chromium

echo "=== [RolePilot] 3/3: Verifying Chromium installation path and binary existence ==="
python -c "
import os, sys
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = '0'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    path = p.chromium.executable_path
    print(f'[RolePilot Build] Expected Chromium path: {path}')
    if not os.path.isfile(path):
        print(f'[RolePilot Build ERROR] Chromium binary not found on disk at {path}', file=sys.stderr)
        sys.exit(1)
    print('[RolePilot Build] Chromium executable verified successfully.')
"

echo "=== [RolePilot] Build complete ==="

