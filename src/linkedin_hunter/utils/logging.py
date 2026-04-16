"""Dual logging setup: rich console + rotating file."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from rich.console import Console
from rich.logging import RichHandler

_configured = False

# On Windows the legacy console renderer (cp1252) cannot encode characters
# like ₹ or €. Reconfigure stderr to UTF-8 so Rich uses the standard
# renderer instead of the Win32 legacy path.
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

console = Console()


def setup_logging(level: str = "INFO", log_file: str = "data/logs/hunter.log") -> logging.Logger:
    """Configure root logger with console (rich) and file handlers."""
    global _configured
    logger = logging.getLogger("linkedin_hunter")

    if _configured:
        return logger

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Rich console handler
    rich_handler = RichHandler(
        console=console,
        show_time=True,
        show_path=False,
        markup=True,
        rich_tracebacks=True,
    )
    rich_handler.setLevel(logging.DEBUG)
    logger.addHandler(rich_handler)

    # File handler
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
    )
    logger.addHandler(file_handler)

    _configured = True
    return logger


def get_logger(name: str = "linkedin_hunter") -> logging.Logger:
    return logging.getLogger(name)
