"""Async retry with exponential backoff."""

from __future__ import annotations

import asyncio
import functools
import random
from typing import Callable, TypeVar

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

T = TypeVar("T")


def async_retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exceptions: tuple = (Exception,),
):
    """Decorator for retrying async functions with exponential backoff + jitter."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_attempts:
                        log.error(
                            "All %d attempts failed for %s: %s",
                            max_attempts, func.__name__, e,
                        )
                        raise
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
                    jitter = random.uniform(0, delay * 0.5)
                    wait = delay + jitter
                    log.warning(
                        "Attempt %d/%d for %s failed: %s. Retrying in %.1fs",
                        attempt, max_attempts, func.__name__, e, wait,
                    )
                    await asyncio.sleep(wait)
            raise last_exception  # type: ignore[misc]
        return wrapper
    return decorator
