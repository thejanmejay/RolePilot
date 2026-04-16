"""Token bucket rate limiter for controlling action frequency."""

from __future__ import annotations

import asyncio
import time

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


class RateLimiter:
    """Token bucket rate limiter.

    Allows `rate` actions per `per` seconds, with optional burst capacity.
    """

    def __init__(self, rate: float, per: float = 60.0, burst: int = 1):
        self.rate = rate
        self.per = per
        self.burst = burst
        self._tokens = float(burst)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Wait until a token is available, then consume one."""
        async with self._lock:
            while True:
                self._refill()
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                # Calculate wait time until next token
                wait = (1.0 - self._tokens) * (self.per / self.rate)
                log.debug("Rate limited, waiting %.1fs", wait)
                await asyncio.sleep(wait)

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(
            float(self.burst),
            self._tokens + elapsed * (self.rate / self.per),
        )
        self._last_refill = now

    @property
    def available(self) -> float:
        self._refill()
        return self._tokens
