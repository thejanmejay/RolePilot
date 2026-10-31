"""Playwright browser lifecycle manager."""

from __future__ import annotations

import asyncio
import glob
import inspect
import os
import sys
from pathlib import Path
from typing import Any, Optional

import playwright
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

from linkedin_hunter.config import HunterConfig
from linkedin_hunter.browser.stealth import apply_stealth
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


class BrowserEngine:
    """Manages Playwright browser lifecycle."""

    def __init__(self, config: HunterConfig):
        self.config = config
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    def _find_fallback_chromium(self) -> Optional[str]:
        """Search fallback locations for Chromium binary if expected path is missing."""
        # 1. Search hermetic site-packages driver directory
        try:
            driver_dir = Path(inspect.getfile(playwright)).parent / "driver" / "package" / ".local-browsers"
            if driver_dir.exists():
                pattern_linux = str(driver_dir / "chromium-*" / "chrome-linux64" / "chrome")
                matches = glob.glob(pattern_linux)
                if not matches:
                    pattern_mac = str(driver_dir / "chromium-*" / "chrome-mac*" / "**" / "Google Chrome for Testing")
                    matches = glob.glob(pattern_mac, recursive=True)
                if matches and os.path.isfile(matches[0]):
                    return matches[0]
        except Exception:
            pass

        # 2. Search user cache directory
        try:
            cache_dir = Path.home() / ".cache" / "ms-playwright"
            if cache_dir.exists():
                pattern_linux = str(cache_dir / "chromium-*" / "chrome-linux64" / "chrome")
                matches = glob.glob(pattern_linux)
                if matches and os.path.isfile(matches[0]):
                    return matches[0]
        except Exception:
            pass

        return None


    async def launch(self, headless: Optional[bool] = None) -> Page:
        """Launch browser and return a page."""
        bc = self.config.browser

        # Auto-configure PLAYWRIGHT_BROWSERS_PATH on Render/production if not already set
        if "PLAYWRIGHT_BROWSERS_PATH" not in os.environ:
            is_render_env = (
                os.getenv("RENDER") == "true"
                or os.getenv("ENVIRONMENT") == "production"
                or os.path.exists("/opt/render/project/src")
            )
            if is_render_env:
                os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

        # Headless mode: Enforce headless on Render/production or Linux without DISPLAY;
        # preserve local config for manual visual inspection
        is_headless_server = (
            os.getenv("RENDER") == "true"
            or os.getenv("ENVIRONMENT") == "production"
            or (sys.platform.startswith("linux") and "DISPLAY" not in os.environ)
        )
        if is_headless_server:
            use_headless = True
        elif headless is not None:
            use_headless = headless
        else:
            use_headless = bc.headless

        self._playwright = await async_playwright().start()

        launch_args: dict[str, Any] = {
            "headless": use_headless,
            "slow_mo": bc.slow_mo,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        }

        # Inspect executable path and discover fallback if default path is missing
        expected_path = self._playwright.chromium.executable_path
        if expected_path and os.path.isfile(expected_path):
            launch_args["executable_path"] = expected_path
        else:
            fallback = self._find_fallback_chromium()
            if fallback:
                launch_args["executable_path"] = fallback
                log.info("Using discovered Chromium fallback executable: %s", fallback)

        try:
            self._browser = await self._playwright.chromium.launch(**launch_args)
        except Exception as exc:
            err_msg = str(exc)
            if "Executable doesn't exist" in err_msg or "Please run" in err_msg or "not found" in err_msg:
                active_path = launch_args.get("executable_path") or expected_path
                log.error("Chromium executable missing at %s: %s", active_path, err_msg)
                raise RuntimeError(
                    f"Chromium executable not found at '{active_path}'. "
                    "Render remediation: ensure Render Build Command includes "
                    "'export PLAYWRIGHT_BROWSERS_PATH=0 && python -m pip install -r requirements.txt && python -m playwright install --with-deps chromium' "
                    "and PLAYWRIGHT_BROWSERS_PATH=0 is added to environment variables."
                ) from exc
            raise

        context_args = {
            "viewport": {"width": 1366, "height": 768},
            "user_agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            "locale": "en-US",
            "timezone_id": "America/New_York",
            "java_script_enabled": True,
        }

        self._context = await self._browser.new_context(**context_args)
        self._context.set_default_timeout(bc.timeout)

        self._page = await self._context.new_page()

        # Apply stealth patches
        await apply_stealth(self._page)

        log.info("Browser launched (headless=%s)", use_headless)
        return self._page

    async def load_cookies(self, cookies: list[dict]) -> None:
        """Load cookies into the browser context."""
        if self._context and cookies:
            await self._context.add_cookies(cookies)
            log.info("Loaded %d cookies into browser context", len(cookies))

    @property
    def page(self) -> Page:
        if self._page is None:
            raise RuntimeError("Browser not launched. Call launch() first.")
        return self._page

    @property
    def context(self) -> BrowserContext:
        if self._context is None:
            raise RuntimeError("Browser not launched. Call launch() first.")
        return self._context

    async def close(self) -> None:
        """Gracefully shut down browser."""
        if self._page:
            try:
                if not self._page.is_closed():
                    await self._page.close()
            except Exception as e:
                log.warning("Exception while closing page: %s", e)
            self._page = None

        if self._context:
            try:
                await self._context.close()
            except Exception as e:
                log.warning("Exception while closing context: %s", e)
            self._context = None

        if self._browser:
            try:
                await self._browser.close()
            except Exception as e:
                log.warning("Exception while closing browser: %s", e)
            self._browser = None

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception as e:
                log.warning("Exception while stopping playwright: %s", e)
            self._playwright = None

        log.info("Browser closed")

    async def __aenter__(self) -> "BrowserEngine":
        await self.launch()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()
