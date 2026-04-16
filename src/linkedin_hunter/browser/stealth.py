"""Anti-detection patches using playwright-stealth and custom JS."""

from __future__ import annotations

from playwright.async_api import Page
from playwright_stealth import Stealth

from linkedin_hunter.utils.logging import get_logger

_stealth = Stealth()

log = get_logger(__name__)

# Additional JS patches beyond what playwright-stealth covers
_EXTRA_PATCHES = """
// Override navigator.webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Fix chrome.runtime to look real
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};

// Remove automation indicators
delete window.__playwright;
delete window.__pw_manual;

// Fix permissions query
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

// Fix plugins length
Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
});

// Fix languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
});
"""


async def apply_stealth(page: Page) -> None:
    """Apply all stealth patches to a page."""
    # Use playwright-stealth library
    await _stealth.apply_stealth_async(page)

    # Apply additional custom patches
    await page.add_init_script(_EXTRA_PATCHES)

    log.debug("Stealth patches applied")
