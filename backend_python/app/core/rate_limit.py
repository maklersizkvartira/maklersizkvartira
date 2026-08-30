"""In-process sliding-window rate limiting.

Deliberately dependency-free: the platform runs as a single Railway service,
so an in-memory limiter is both sufficient and one less thing to operate. The
interface is narrow enough that swapping in Redis later means reimplementing
one method.

Limits that must survive a restart - account lockout, OTP daily caps - are
enforced from database rows instead, in ``app.services.auth``.
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field

from app.core.errors import TooManyRequests


@dataclass(slots=True)
class _Window:
    hits: deque[float] = field(default_factory=deque)


@dataclass(frozen=True, slots=True)
class RateLimitRule:
    """``limit`` requests per ``window_seconds``, keyed by scope+identifier."""

    name: str
    limit: int
    window_seconds: int

    def retry_after(self, oldest_hit: float, now: float) -> int:
        return max(1, int(oldest_hit + self.window_seconds - now) + 1)


class RateLimiter:
    def __init__(self, *, max_keys: int = 50_000) -> None:
        self._windows: dict[str, _Window] = {}
        self._lock = asyncio.Lock()
        self._max_keys = max_keys
        self._last_sweep = time.monotonic()

    async def check(
        self, rule: RateLimitRule, identifier: str, *, cost: int = 1
    ) -> None:
        """Consume ``cost`` from the bucket, or raise ``TooManyRequests``."""
        key = f"{rule.name}:{identifier}"
        now = time.monotonic()
        cutoff = now - rule.window_seconds

        async with self._lock:
            self._maybe_sweep(now)
            window = self._windows.get(key)
            if window is None:
                window = _Window()
                self._windows[key] = window

            hits = window.hits
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) + cost > rule.limit:
                retry_after = rule.retry_after(hits[0], now) if hits else rule.window_seconds
                raise TooManyRequests(
                    params={"retry_after": retry_after},
                    headers={"Retry-After": str(retry_after)},
                )

            for _ in range(cost):
                hits.append(now)

    async def peek(self, rule: RateLimitRule, identifier: str) -> int:
        """Remaining allowance without consuming any."""
        key = f"{rule.name}:{identifier}"
        now = time.monotonic()
        cutoff = now - rule.window_seconds
        async with self._lock:
            window = self._windows.get(key)
            if window is None:
                return rule.limit
            while window.hits and window.hits[0] <= cutoff:
                window.hits.popleft()
            return max(0, rule.limit - len(window.hits))

    async def reset(self, rule: RateLimitRule, identifier: str) -> None:
        """Clear a bucket - used after a successful login so one bad password
        does not count against the user for the rest of the window."""
        async with self._lock:
            self._windows.pop(f"{rule.name}:{identifier}", None)

    def _maybe_sweep(self, now: float) -> None:
        """Drop empty and stale windows so memory cannot grow without bound."""
        if now - self._last_sweep < 60 and len(self._windows) < self._max_keys:
            return
        self._last_sweep = now
        stale = [key for key, w in self._windows.items() if not w.hits or w.hits[-1] < now - 3600]
        for key in stale:
            self._windows.pop(key, None)
        if len(self._windows) > self._max_keys:
            # Pathological case: evict the oldest half rather than OOM.
            ordered = sorted(
                self._windows.items(), key=lambda kv: kv[1].hits[-1] if kv[1].hits else 0
            )
            for key, _ in ordered[: len(ordered) // 2]:
                self._windows.pop(key, None)


limiter = RateLimiter()


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------
def _rules() -> dict[str, RateLimitRule]:
    from app.core.config import settings

    return {
        "global_ip": RateLimitRule("global_ip", settings.RATE_LIMIT_GLOBAL_PER_MINUTE, 60),
        "auth_ip": RateLimitRule("auth_ip", settings.RATE_LIMIT_AUTH_PER_MINUTE, 60),
        "login_phone": RateLimitRule("login_phone", settings.RATE_LIMIT_AUTH_PER_MINUTE, 60),
        # Keyed on the account, not the IP: signing devices out is idempotent
        # housekeeping by someone already authenticated, and pooling it with
        # "auth_ip" let a user clearing a long session list spend the login and
        # refresh allowance of everyone behind the same NAT.
        "session_revoke": RateLimitRule("session_revoke", 30, 60),
        "otp_phone": RateLimitRule("otp_phone", settings.RATE_LIMIT_OTP_PER_HOUR, 3600),
        "otp_ip": RateLimitRule("otp_ip", settings.RATE_LIMIT_OTP_PER_HOUR * 2, 3600),
        "register_ip": RateLimitRule("register_ip", 8, 3600),
        "listing_create": RateLimitRule(
            "listing_create", settings.RATE_LIMIT_LISTING_CREATE_PER_HOUR, 3600
        ),
        "listing_write": RateLimitRule("listing_write", 60, 3600),
        "ai_chat": RateLimitRule("ai_chat", 30, 3600),
        # Admin recovery. Three attempts an hour is plenty for a real
        # recovery and useless for guessing at the token.
        "bootstrap_admin": RateLimitRule("bootstrap_admin", 3, 3600),
        "stat_ip": RateLimitRule("stat_ip", 240, 3600),
        "report_ip": RateLimitRule("report_ip", 10, 3600),
        # Keyed on the user id, like "listing_write": the Top endpoint is
        # authenticated and ownership-checked, so the account is the subject.
        "top_request": RateLimitRule("top_request", 10, 3600),
        "admin_login_ip": RateLimitRule("admin_login_ip", 8, 900),
        "password_reveal": RateLimitRule("password_reveal", 30, 3600),
    }


_RULES: dict[str, RateLimitRule] | None = None


def rule(name: str) -> RateLimitRule:
    global _RULES
    if _RULES is None:
        _RULES = _rules()
    try:
        return _RULES[name]
    except KeyError as exc:  # pragma: no cover - programming error
        raise KeyError(f"Unknown rate-limit rule: {name}") from exc


async def enforce(name: str, identifier: str, *, cost: int = 1) -> None:
    await limiter.check(rule(name), identifier, cost=cost)


async def clear(name: str, identifier: str) -> None:
    await limiter.reset(rule(name), identifier)
