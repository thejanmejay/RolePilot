"""Cookie storage, loading, and validation."""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Any, Dict, Optional

from linkedin_hunter.config import get_project_root
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

COOKIE_FILE = "data/cookies.json"


def _cookie_path() -> Path:
    root = get_project_root()
    default_path = root / COOKIE_FILE
    if default_path.exists():
        return default_path
    
    # Fallback to subdirectory if present
    alt_path = root / "linkedin-hunter" / "data" / "cookies.json"
    if alt_path.exists():
        return alt_path
        
    return default_path


def save_cookies(cookies: list[dict]) -> Path:
    """Save cookies to JSON file with restricted permissions."""
    path = _cookie_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:
        json.dump(cookies, f, indent=2)

    # chmod 600 - owner read/write only
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    log.info("Saved %d cookies to %s", len(cookies), path)
    return path


def load_cookies() -> Optional[list[dict]]:
    """Load cookies from JSON file. Returns None if not found."""
    path = _cookie_path()
    if not path.exists():
        log.warning("No cookie file found at %s", path)
        return None

    with open(path) as f:
        cookies = json.load(f)

    log.info("Loaded %d cookies from %s", len(cookies), path)
    return cookies


def has_valid_session() -> bool:
    """Check if we have a cookie file with LinkedIn session cookies."""
    cookies = load_cookies()
    if not cookies:
        return False

    # Check for essential LinkedIn session cookie
    li_at = any(c.get("name") == "li_at" for c in cookies)
    if not li_at:
        log.warning("Cookie file exists but missing li_at session cookie")
        return False

    return True


async def check_session_health(page) -> Dict[str, Any]:
    """Validate LinkedIn session state in the browser.

    Returns:
        Dict with keys: authenticated, session_available, login_redirect, checkpoint_detected, details
    """
    session_available = has_valid_session()
    if not session_available:
        return {
            "authenticated": False,
            "session_available": False,
            "login_redirect": False,
            "checkpoint_detected": False,
            "details": "No LinkedIn session cookies found.",
        }

    try:
        current_url = page.url or ""
        # If page has not navigated yet, go to feed
        if not current_url or current_url.startswith("about:") or current_url.startswith("data:"):
            await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=15000)
            current_url = page.url

        is_login_redirect = any(
            x in current_url for x in ["/login", "/authwall", "/uas/login", "/signup"]
        )
        is_checkpoint = any(
            x in current_url for x in ["/checkpoint", "/challenge", "/security-check"]
        )

        # Check URL, title, and DOM indicators
        is_feed = any(x in current_url for x in ["/feed", "/mynetwork", "/jobs", "/in/"])
        raw_title = page.title() if callable(getattr(page, "title", None)) else getattr(page, "title", "")
        if hasattr(raw_title, "__await__"):
            raw_title = await raw_title
        title = str(raw_title or "")
        is_not_login_title = not any(x in title.lower() for x in ["sign in", "log in", "authwall", "join linkedin"])

        nav = await page.query_selector("nav, header, nav.global-nav, div.global-nav__me, #global-nav, div.scaffold-layout")
        profile_menu = await page.query_selector("button.global-nav__primary-link-me-menu-trigger, button[aria-label*='Me'], button[aria-label*='profile' i]")
        checkpoint_dom = await page.query_selector("div#captcha-internal, div.checkpoint-challenge, #captcha-challenge")

        if checkpoint_dom:
            is_checkpoint = True

        authenticated = bool(
            (nav or profile_menu or (is_feed and is_not_login_title))
            and not is_login_redirect
            and not is_checkpoint
        )

        return {
            "authenticated": authenticated,
            "session_available": True,
            "login_redirect": is_login_redirect,
            "checkpoint_detected": is_checkpoint,
            "details": "Authenticated session verified." if authenticated else (
                "Checkpoint / Challenge detected." if is_checkpoint else (
                    "Redirected to login page." if is_login_redirect else "Authentication indicators not detected."
                )
            ),
        }

    except Exception as e:
        log.warning("Error during session health check: %s", e)
        return {
            "authenticated": False,
            "session_available": True,
            "login_redirect": False,
            "checkpoint_detected": False,
            "details": f"Session verification error: {str(e)}",
        }


def clear_cookies() -> None:
    """Delete the cookie file."""
    path = _cookie_path()
    if path.exists():
        path.unlink()
        log.info("Cleared cookies")

