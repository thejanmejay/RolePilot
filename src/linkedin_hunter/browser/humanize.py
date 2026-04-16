"""Human-like behavior simulation: random delays, typing, scrolling."""

from __future__ import annotations

import asyncio
import random

from playwright.async_api import Page

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


async def random_delay(min_s: float = 1.0, max_s: float = 3.0) -> None:
    """Sleep for a random duration between min and max seconds."""
    delay = random.uniform(min_s, max_s)
    await asyncio.sleep(delay)


async def human_delay() -> None:
    """Standard human-like pause between actions (2-7s)."""
    await random_delay(2.0, 7.0)


async def short_delay() -> None:
    """Short delay for rapid interactions (0.5-1.5s)."""
    await random_delay(0.5, 1.5)


async def human_type(page: Page, selector: str, text: str, clear: bool = True) -> None:
    """Type text character by character with human-like delays."""
    element = await page.wait_for_selector(selector, state="visible")
    if not element:
        return

    if clear:
        await element.click(click_count=3)
        await page.keyboard.press("Backspace")
        await asyncio.sleep(random.uniform(0.1, 0.3))

    for char in text:
        await page.keyboard.type(char, delay=random.uniform(50, 150))

    log.debug("Typed %d chars into %s", len(text), selector)


async def human_click(page: Page, selector: str) -> None:
    """Click an element with a small random offset and delay."""
    element = await page.wait_for_selector(selector, state="visible", timeout=10000)
    if not element:
        return

    box = await element.bounding_box()
    if box:
        x = box["x"] + box["width"] * random.uniform(0.3, 0.7)
        y = box["y"] + box["height"] * random.uniform(0.3, 0.7)
        await page.mouse.move(x, y, steps=random.randint(5, 15))
        await asyncio.sleep(random.uniform(0.1, 0.3))
        await page.mouse.click(x, y)
    else:
        await element.click()

    log.debug("Clicked %s", selector)


async def smooth_scroll(page: Page, direction: str = "down", distance: int = 300) -> None:
    """Scroll the page smoothly in increments."""
    steps = random.randint(3, 6)
    step_distance = distance // steps
    delta = step_distance if direction == "down" else -step_distance

    for _ in range(steps):
        await page.mouse.wheel(0, delta)
        await asyncio.sleep(random.uniform(0.05, 0.15))

    log.debug("Scrolled %s by ~%dpx", direction, distance)


async def scroll_to_bottom(page: Page, pause: float = 1.0) -> None:
    """Scroll to the bottom of the page gradually."""
    prev_height = 0
    while True:
        height = await page.evaluate("document.body.scrollHeight")
        if height == prev_height:
            break
        await smooth_scroll(page, "down", 500)
        await asyncio.sleep(pause)
        prev_height = height


async def random_mouse_jiggle(page: Page) -> None:
    """Small random mouse movements to appear human."""
    x = random.randint(200, 1000)
    y = random.randint(200, 600)
    await page.mouse.move(x, y, steps=random.randint(10, 25))
