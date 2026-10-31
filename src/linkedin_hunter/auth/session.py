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


def has_valid_session(cookies: Optional[list[dict]] = None) -> bool:
    """Check if we have valid LinkedIn session cookies in memory or file."""
    cookie_list = cookies if cookies is not None else load_cookies()
    if not cookie_list:
        return False

    # Check for essential LinkedIn session cookie with non-empty value
    li_at = any(
        isinstance(c, dict)
        and c.get("name") == "li_at"
        and bool(str(c.get("value", "")).strip())
        for c in cookie_list
    )
    if not li_at:
        log.warning("Session cookies present but missing non-empty li_at cookie")
        return False

    return True


async def check_session_health(
    page,
    cookies: Optional[list[dict]] = None,
) -> Dict[str, Any]:
    """Validate LinkedIn session state in the browser.

    Multi-signal verification:
    1. Active session availability: checks injected cookies or browser context cookies directly (not reliant on local disk).
    2. URL validation: detects login/authwall redirects vs authenticated paths.
    3. Title & DOM indicators: validates global nav and profile trigger presence vs login inputs and checkpoints/challenges.
    """
    # 1. Inspect cookies in active browser context or explicit parameter
    active_cookies = cookies
    if active_cookies is None and hasattr(page, "context") and hasattr(page.context, "cookies"):
        try:
            res = page.context.cookies()
            if hasattr(res, "__await__"):
                active_cookies = await res
            else:
                active_cookies = res
        except Exception as e:
            log.warning("Could not read cookies from browser context: %s", e)

    session_available = has_valid_session(active_cookies)
    if not session_available:
        # Fallback to local cookie file if not in context/param (for local dev/test workflows)
        session_available = has_valid_session(None)

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
            try:
                await page.goto("https://www.linkedin.com/feed/", wait_until="commit", timeout=20000)
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=8000)
                except Exception:
                    pass
            except Exception as goto_err:
                err_text = str(goto_err)
                if "ERR_TOO_MANY_REDIRECTS" in err_text:
                    log.warning("LinkedIn redirected too many times on /feed/ (session expired): %s", goto_err)
                    return {
                        "authenticated": False,
                        "session_available": True,
                        "login_redirect": True,
                        "checkpoint_detected": False,
                        "is_chrome_error": True,
                        "details": "Redirect loop on authentication (expired session).",
                    }
                raise goto_err
            current_url = page.url or ""

        is_chrome_error = any(
            x in (current_url or "").lower() for x in ["chrome-error://", "chromewebdata"]
        )

        is_login_redirect = any(
            x in current_url for x in ["/login", "/authwall", "/uas/login", "/signup"]
        )
        is_checkpoint = any(
            x in current_url for x in ["/checkpoint", "/challenge", "/security-check"]
        )

        raw_title = page.title() if callable(getattr(page, "title", None)) else getattr(page, "title", "")
        if hasattr(raw_title, "__await__"):
            raw_title = await raw_title
        title = str(raw_title or "")
        is_not_login_title = not any(x in title.lower() for x in ["sign in", "log in", "authwall", "join linkedin"])

        try:
            await page.wait_for_selector(
                "nav, header, nav.global-nav, div.global-nav__me, #global-nav, div.scaffold-layout, input#username, div#captcha-internal",
                timeout=8000,
            )
        except Exception:
            pass

        nav = await page.query_selector("nav, header, nav.global-nav, div.global-nav__me, #global-nav, div.scaffold-layout")
        profile_menu = await page.query_selector("button.global-nav__primary-link-me-menu-trigger, button[aria-label*='Me'], button[aria-label*='profile' i]")
        checkpoint_dom = await page.query_selector("div#captcha-internal, div.checkpoint-challenge, #captcha-challenge")

        if checkpoint_dom:
            is_checkpoint = True

        # STRICT MULTI-SIGNAL AUTHENTICATION INVARIANT:
        # A session is ONLY authenticated if real authenticated DOM indicators are present,
        # AND it is not on a Chrome error page, login redirect, or security checkpoint.
        is_feed = "linkedin.com/feed" in current_url and "feed" in title.lower()
        has_auth_dom = bool(nav or profile_menu or is_feed)
        log.info(
            "check_session_health: url=%s title=%s nav=%s profile_menu=%s is_feed=%s login_redirect=%s",
            current_url,
            title,
            bool(nav),
            bool(profile_menu),
            is_feed,
            is_login_redirect,
        )
        authenticated = bool(
            has_auth_dom
            and not is_chrome_error
            and not is_login_redirect
            and not is_checkpoint
        )

        return {
            "authenticated": authenticated,
            "session_available": True,
            "login_redirect": is_login_redirect,
            "checkpoint_detected": is_checkpoint,
            "is_chrome_error": is_chrome_error,
            "details": "Authenticated session verified." if authenticated else (
                "Checkpoint / Challenge detected." if is_checkpoint else (
                    "Redirected to login page." if is_login_redirect else (
                        "Chrome error page reached (navigation failed)." if is_chrome_error else "Authentication indicators not detected."
                    )
                )
            ),
        }

    except Exception as e:
        log.warning("Error during session health check: %s", e)
        err_str = str(e)
        is_redirect_loop = "ERR_TOO_MANY_REDIRECTS" in err_str
        return {
            "authenticated": False,
            "session_available": True,
            "login_redirect": is_redirect_loop,
            "checkpoint_detected": False,
            "is_chrome_error": "chrome-error" in (getattr(page, "url", "") or "") or "chromewebdata" in (getattr(page, "url", "") or ""),
            "details": "Redirect loop detected (expired session)." if is_redirect_loop else f"Session verification error: {err_str}",
        }


def clear_cookies() -> None:
    """Delete the cookie file."""
    path = _cookie_path()
    if path.exists():
        path.unlink()
        log.info("Cleared cookies")

