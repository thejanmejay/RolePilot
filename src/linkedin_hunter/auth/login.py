"""Interactive LinkedIn login via browser."""

from __future__ import annotations

import asyncio

from rich.console import Console

from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.auth.session import save_cookies, has_valid_session
from linkedin_hunter.config import HunterConfig
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)
console = Console()

LOGIN_URL = "https://www.linkedin.com/login"
FEED_URL = "https://www.linkedin.com/feed/"
CHECK_INTERVAL = 2  # seconds
TIMEOUT = 300  # 5 minutes max wait


async def interactive_login(config: HunterConfig) -> bool:
    """Launch browser for manual login, capture cookies on success."""

    if has_valid_session():
        console.print("[yellow]Existing session found.[/yellow]")
        console.print("Use [cyan]linkedin-hunter login --force[/cyan] to re-login, or continuing with existing cookies.")

    console.print("\n[bold]Opening LinkedIn login page...[/bold]")
    console.print("[dim]Please log in manually. The browser will stay open until you complete login.[/dim]")
    console.print("[dim]Timeout: 5 minutes[/dim]\n")

    engine = BrowserEngine(config)

    try:
        page = await engine.launch(headless=False)
        await page.goto(LOGIN_URL, wait_until="domcontentloaded")

        console.print("[cyan]Waiting for you to log in...[/cyan]")

        # Poll for redirect to /feed (indicates successful login)
        elapsed = 0
        logged_in = False

        while elapsed < TIMEOUT:
            await asyncio.sleep(CHECK_INTERVAL)
            elapsed += CHECK_INTERVAL

            try:
                current_url = page.url
                if "/feed" in current_url or "/mynetwork" in current_url:
                    logged_in = True
                    break

                # Also check for the presence of the nav element that only shows when logged in
                nav = await page.query_selector("nav.global-nav")
                if nav:
                    logged_in = True
                    break
            except Exception:
                # Page may be mid-navigation; wait and retry
                continue

        if not logged_in:
            console.print("[bold red]Login timed out after 5 minutes.[/bold red]")
            log.error("Login timed out")
            return False

        # Capture cookies
        cookies = await engine.context.cookies()
        save_cookies(cookies)

        console.print("\n[bold green]Login successful![/bold green] Cookies saved.")
        log.info("Login successful, %d cookies saved", len(cookies))
        return True

    except Exception as e:
        console.print(f"[bold red]Login error: {e}[/bold red]")
        log.exception("Login failed")
        return False

    finally:
        await engine.close()
