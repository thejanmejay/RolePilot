#!/usr/bin/env bash
# RolePilot Render Build Script
# Ensures Python dependencies and Playwright Chromium headless binaries/system libs are installed.

set -euo pipefail

echo "=== [RolePilot] 1/2: Installing Python dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== [RolePilot] 2/2: Installing Playwright Chromium & system libraries ==="
playwright install --with-deps chromium

echo "=== [RolePilot] Build complete ==="
