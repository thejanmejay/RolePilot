"""Browser Diagnostics and Chromium Installation Verification."""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import glob
import importlib.metadata
import inspect
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("linkedin_hunter.browser_diagnostics")


class BrowserUnavailableException(RuntimeError):
    """Raised when the required Playwright browser engine or Chromium binary is unavailable."""

    def __init__(self, diagnostics: Dict[str, Any]) -> None:
        self.diagnostics = diagnostics
        super().__init__(diagnostics.get("error") or "Browser engine is unavailable")


def get_playwright_version() -> str:
    """Retrieve installed Playwright package version safely."""
    try:
        return importlib.metadata.version("playwright")
    except Exception:
        try:
            from playwright._repo_version import version
            return str(version)
        except Exception:
            return "unknown"


def configure_playwright_browsers_path() -> str:
    """Ensure PLAYWRIGHT_BROWSERS_PATH is properly initialized.
    
    On Render and production native environments, defaults to '0' (hermetic install
    in virtualenv site-packages) so browser binaries survive deployment container packaging.
    """
    current = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if current is not None:
        return current

    # Auto-detect Render or production deployment
    is_render = (
        os.getenv("RENDER") == "true"
        or os.getenv("ENVIRONMENT") == "production"
        or os.path.exists("/opt/render/project/src")
    )
    if is_render:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"
        logger.info("Automatically configured PLAYWRIGHT_BROWSERS_PATH=0 for Render/production environment")
        return "0"

    return "default (~/.cache/ms-playwright)"


def find_existing_chromium_executable(primary_path: Optional[str] = None) -> Tuple[Optional[str], bool]:
    """Check if the expected Chromium executable exists, and search fallbacks if missing."""
    if primary_path and os.path.isfile(primary_path):
        return primary_path, True

    # Search hermetic driver path (<site-packages>/playwright/driver/package/.local-browsers)
    try:
        import playwright
        driver_dir = Path(inspect.getfile(playwright)).parent / "driver" / "package" / ".local-browsers"
        if driver_dir.exists():
            pattern = str(driver_dir / "chromium-*" / "chrome-linux64" / "chrome")
            matches = glob.glob(pattern)
            if not matches:
                # macOS pattern fallback
                pattern_mac = str(driver_dir / "chromium-*" / "chrome-mac*" / "**" / "Google Chrome for Testing")
                matches = glob.glob(pattern_mac, recursive=True)
            if matches and os.path.isfile(matches[0]):
                return matches[0], True
    except Exception:
        pass

    # Search user cache path (~/.cache/ms-playwright)
    try:
        cache_dir = Path.home() / ".cache" / "ms-playwright"
        if cache_dir.exists():
            pattern = str(cache_dir / "chromium-*" / "chrome-linux64" / "chrome")
            matches = glob.glob(pattern)
            if matches and os.path.isfile(matches[0]):
                return matches[0], True
    except Exception:
        pass

    return primary_path, False


def check_chromium_availability() -> Dict[str, Any]:
    """Verify whether Playwright and Chromium headless browser are installed and runnable.
    
    Safe diagnostic: Does not leak tokens or credentials while reporting
    Playwright version, expected executable path, and file existence.
    """
    # 1. Initialize environment path policy
    browsers_path_mode = configure_playwright_browsers_path()
    pw_version = get_playwright_version()

    is_headless_enforced = (
        os.getenv("RENDER") == "true"
        or os.getenv("ENVIRONMENT") == "production"
        or (sys.platform.startswith("linux") and "DISPLAY" not in os.environ)
    )

    # 2. Check Playwright library installation
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        logger.error("Playwright package is not installed: %s", e)
        return {
            "available": False,
            "browser": "chromium",
            "status": "uninstalled",
            "playwright_version": pw_version,
            "expected_executable_path": None,
            "binary_exists": False,
            "browsers_path_mode": browsers_path_mode,
            "headless_enforced": is_headless_enforced,
            "error": "Playwright library is not installed in the current environment.",
            "remediation": "Add 'playwright>=1.40.0' to requirements.txt and run 'python -m pip install -r requirements.txt'.",
        }

    # 3. Query executable path and verify file presence
    def _probe_browser() -> Dict[str, Any]:
        with sync_playwright() as p:
            expected_path = p.chromium.executable_path
            resolved_path, binary_exists = find_existing_chromium_executable(expected_path)

            if not expected_path and not resolved_path:
                return {
                    "available": False,
                    "browser": "chromium",
                    "status": "missing_path",
                    "playwright_version": pw_version,
                    "expected_executable_path": None,
                    "binary_exists": False,
                    "browsers_path_mode": browsers_path_mode,
                    "headless_enforced": is_headless_enforced,
                    "error": "Chromium executable path is empty.",
                    "remediation": "Set PLAYWRIGHT_BROWSERS_PATH=0 and run 'python -m playwright install --with-deps chromium'.",
                }

            active_path = resolved_path or expected_path

            if not binary_exists:
                return {
                    "available": False,
                    "browser": "chromium",
                    "status": "missing_executable",
                    "playwright_version": pw_version,
                    "expected_executable_path": active_path,
                    "binary_exists": False,
                    "browsers_path_mode": browsers_path_mode,
                    "headless_enforced": is_headless_enforced,
                    "error": "Chromium browser binary or system dependencies are unavailable.",
                    "details": f"Chromium binary not found on disk at expected location: {active_path}",
                    "remediation": "Update Render build command to: export PLAYWRIGHT_BROWSERS_PATH=0 && python -m pip install -r requirements.txt && python -m playwright install --with-deps chromium (and set PLAYWRIGHT_BROWSERS_PATH=0 in Render environment variables).",
                }

            # 4. Attempt quick headless launch probe
            launch_kwargs: Dict[str, Any] = {
                "headless": True,
                "args": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            }
            if active_path:
                launch_kwargs["executable_path"] = active_path

            browser = p.chromium.launch(**launch_kwargs)
            browser.close()

            return {
                "available": True,
                "browser": "chromium",
                "status": "ready",
                "playwright_version": pw_version,
                "expected_executable_path": active_path,
                "binary_exists": True,
                "browsers_path_mode": browsers_path_mode,
                "headless_enforced": is_headless_enforced,
                "message": "Chromium headless browser engine is installed and operational.",
            }

    try:
        try:
            asyncio.get_running_loop()
            in_async_loop = True
        except RuntimeError:
            in_async_loop = False

        if in_async_loop:
            with ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(_probe_browser).result(timeout=15)
        else:
            return _probe_browser()

    except Exception as exc:
        err_msg = str(exc)
        logger.warning("Chromium launch check failed: %s", err_msg)
        is_missing_binary = (
            "Executable doesn't exist" in err_msg
            or "Please run" in err_msg
            or "not found" in err_msg
            or "cannot open shared object file" in err_msg
        )
        return {
            "available": False,
            "browser": "chromium",
            "status": "missing_executable" if is_missing_binary else "launch_failed",
            "playwright_version": pw_version,
            "expected_executable_path": locals().get("active_path", locals().get("expected_path", None)),
            "binary_exists": False if is_missing_binary else locals().get("binary_exists", False),
            "browsers_path_mode": browsers_path_mode,
            "headless_enforced": is_headless_enforced,
            "error": "Chromium browser binary or system dependencies are unavailable." if is_missing_binary else "Chromium launch probe failed.",
            "details": f"Launch failure: {err_msg}",
            "remediation": "Update Render build command to: export PLAYWRIGHT_BROWSERS_PATH=0 && python -m pip install -r requirements.txt && python -m playwright install --with-deps chromium (and set PLAYWRIGHT_BROWSERS_PATH=0 in Render environment variables).",
        }


def verify_browser_runtime() -> Dict[str, Any]:
    """Fail-fast verification executed before running automated browser tasks.
    
    Raises BrowserUnavailableException if Chromium is not operational.
    """
    diag = check_chromium_availability()
    if not diag.get("available"):
        raise BrowserUnavailableException(diag)
    return diag
