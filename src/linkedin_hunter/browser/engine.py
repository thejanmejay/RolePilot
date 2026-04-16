"""Playwright browser lifecycle manager."""

from __future__ import annotations

import asyncio
from typing import Optional

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

    async def launch(self, headless: Optional[bool] = None) -> Page:
        """Launch browser and return a page."""
        bc = self.config.browser
        use_headless = headless if headless is not None else bc.headless

        self._playwright = await async_playwright().start()

        launch_args = {
            "headless": use_headless,
            "slow_mo": bc.slow_mo,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-infobars",
            ],
        }

        self._browser = await self._playwright.chromium.launch(**launch_args)

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
            await self._page.close()
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        log.info("Browser closed")

    async def __aenter__(self) -> "BrowserEngine":
        await self.launch()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()
