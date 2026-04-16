"""Cookie storage, loading, and validation."""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Optional

from linkedin_hunter.config import get_project_root
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

COOKIE_FILE = "data/cookies.json"


def _cookie_path() -> Path:
    return get_project_root() / COOKIE_FILE


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


def clear_cookies() -> None:
    """Delete the cookie file."""
    path = _cookie_path()
    if path.exists():
        path.unlink()
        log.info("Cleared cookies")
