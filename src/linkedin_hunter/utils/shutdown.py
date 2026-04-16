"""Graceful shutdown handling for the application.

Provides a global shutdown flag that all async loops should check,
and registers signal handlers for SIGINT/SIGTERM so that Ctrl+C
or 'stop' causes an immediate, clean shutdown.
"""

from __future__ import annotations

import asyncio
import signal
import sys
from typing import Optional

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

# Global shutdown event — all loops should check this
_shutdown_event: Optional[asyncio.Event] = None


def get_shutdown_event() -> asyncio.Event:
    """Get or create the global shutdown event for the current event loop."""
    global _shutdown_event
    if _shutdown_event is None:
        _shutdown_event = asyncio.Event()
    return _shutdown_event


def is_shutting_down() -> bool:
    """Check if shutdown has been requested. Safe to call from anywhere."""
    if _shutdown_event is None:
        return False
    return _shutdown_event.is_set()


def request_shutdown() -> None:
    """Request a graceful shutdown from any context."""
    global _shutdown_event
    if _shutdown_event is not None:
        _shutdown_event.set()
    log.info("Shutdown requested")


def install_signal_handlers(loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
    """Install SIGINT/SIGTERM handlers that trigger graceful shutdown.

    Call this once at the start of an async session (inside run_apply, etc.).
    """
    event = get_shutdown_event()

    def _handle_signal(sig_name: str) -> None:
        if event.is_set():
            # Second signal → force exit immediately
            log.warning("Force exit (second signal)")
            sys.exit(1)
        log.info("Received %s — shutting down gracefully...", sig_name)
        print(f"\n\033[1;33m⚡ Received {sig_name} — stopping gracefully...\033[0m")
        event.set()

    if loop is None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop — fall back to basic signal handlers
            signal.signal(signal.SIGINT, lambda s, f: _handle_signal("SIGINT"))
            signal.signal(signal.SIGTERM, lambda s, f: _handle_signal("SIGTERM"))
            return

    # Use loop.add_signal_handler for proper async integration (Unix only)
    if sys.platform != "win32":
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, _handle_signal, sig.name)
    else:
        # Windows: fall back to basic signal module
        signal.signal(signal.SIGINT, lambda s, f: _handle_signal("SIGINT"))
        signal.signal(signal.SIGTERM, lambda s, f: _handle_signal("SIGTERM"))


def reset() -> None:
    """Reset shutdown state (for reuse between sessions in tests, etc.)."""
    global _shutdown_event
    _shutdown_event = None
