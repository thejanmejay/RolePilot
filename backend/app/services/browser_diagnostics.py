"""Browser Diagnostics and Chromium Installation Verification."""

from __future__ import annotations

import logging
from typing import Any, Dict

logger = logging.getLogger("linkedin_hunter.browser_diagnostics")


def check_chromium_availability() -> Dict[str, Any]:
    """Verify whether Playwright and Chromium headless browser are installed and runnable.
    
    Safe diagnostic: Does not leak local paths, tokens, or system secrets.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        logger.error("Playwright package is not installed: %s", e)
        return {
            "available": False,
            "browser": "chromium",
            "error": "Playwright library is not installed in the current environment.",
            "remediation": "Add 'playwright>=1.40.0' to requirements.txt and run 'pip install -r requirements.txt'.",
        }

    try:
        with sync_playwright() as p:
            executable_path = p.chromium.executable_path
            # Verify executable path is non-empty
            if not executable_path:
                return {
                    "available": False,
                    "browser": "chromium",
                    "error": "Chromium executable path is empty.",
                    "remediation": "Run 'playwright install --with-deps chromium' during the build phase.",
                }

            # Attempt a quick headless dry-launch probe
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            browser.close()

            return {
                "available": True,
                "browser": "chromium",
                "status": "ready",
                "message": "Chromium headless browser engine is installed and operational.",
            }
    except Exception as exc:
        err_msg = str(exc)
        logger.warning("Chromium launch check failed: %s", err_msg)
        is_missing_binary = "Executable doesn't exist" in err_msg or "Please run" in err_msg or "not found" in err_msg
        return {
            "available": False,
            "browser": "chromium",
            "error": "Chromium browser binary or system dependencies are unavailable." if is_missing_binary else "Chromium launch probe failed.",
            "details": "Chromium binary missing. System command required: 'playwright install --with-deps chromium'" if is_missing_binary else "Browser subsystem error.",
            "remediation": "Update Render/deployment build command to: pip install -r requirements.txt && playwright install --with-deps chromium",
        }
