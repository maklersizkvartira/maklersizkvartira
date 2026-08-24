"""Local development server.

On Windows, uvicorn constructs its event loop through ``asyncio.Runner`` and
no longer consults the event-loop policy, so it would get a ProactorEventLoop
that psycopg's async mode cannot use. Driving the server ourselves with an
explicit loop factory avoids that.

On Linux (including the production container) ``uvicorn app.main:app`` is
equivalent and this file is not used.

    python run_dev.py
"""

from __future__ import annotations

import asyncio

from app.core import platform as _platform

_platform.configure_event_loop()

import uvicorn  # noqa: E402

from app.core.config import settings  # noqa: E402


def main() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower(),
        loop="asyncio",
    )
    server = uvicorn.Server(config)

    factory = _platform.loop_factory()
    if factory is None:
        asyncio.run(server.serve())
    else:
        with asyncio.Runner(loop_factory=factory) as runner:
            runner.run(server.serve())


if __name__ == "__main__":
    main()
