"""Platform compatibility shims.

Windows defaults to ``ProactorEventLoop``, which psycopg's async mode cannot
use. Selecting the selector loop makes local development on Windows behave
like the Linux container in production. On every other platform this module
does nothing.

Import it before anything opens a database connection.
"""

from __future__ import annotations

import asyncio
import selectors
import sys
from collections.abc import Callable


def configure_event_loop() -> None:
    """Set the selector policy on Windows (no-op elsewhere)."""
    if sys.platform != "win32":
        return
    policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
    if policy is None:
        return
    try:
        current = asyncio.get_event_loop_policy()
    except Exception:  # noqa: BLE001 - policies are deprecated in 3.14+
        current = None
    if not isinstance(current, policy):
        asyncio.set_event_loop_policy(policy())


def loop_factory() -> Callable[[], asyncio.AbstractEventLoop] | None:
    """An explicit loop factory for servers that accept one.

    Newer uvicorn builds construct the loop through ``asyncio.Runner`` and no
    longer consult the (deprecated) policy, so passing the factory directly is
    the only reliable way to keep psycopg working on Windows.
    """
    if sys.platform != "win32":
        return None
    return lambda: asyncio.SelectorEventLoop(selectors.SelectSelector())


configure_event_loop()
