"""Assistant settings that can be changed without a deploy.

Which model answers a visitor, which model does the reasoning, and how many
tool round trips one turn may take used to be three environment variables. That
made every change a Railway edit and a restart, and it made the panel's AI page
a read-only poster: it could show what was configured and nothing more.

They live in ``system_settings`` now, beside ``is_monetization_enabled``, and
the environment variables became the fallback. An unset row therefore keeps
exactly today's behaviour — nothing changes until somebody deliberately stores
something — and a stored row survives a deploy, which an environment variable
edited in a hurry during an incident does not always do.

Where the value is read
-----------------------
:func:`load` needs a session and is called by the agent loop, which has one.
:func:`cached` needs nothing and is for :mod:`app.services.uyiz_ai`, whose
provider call is three frames below the request and has no session to hand. It
answers from whatever this process last read; with nothing read yet it answers
from the environment, which is the pre-existing behaviour rather than a guess.
That is safe because the deterministic path only ever runs *after* the agent
loop has run and refreshed the rows in the same request.

The environment is never cached, only the rows are. Freezing a snapshot of
``settings`` would have meant a test that monkeypatches ``OPENAI_MODEL`` got the
model some earlier test happened to warm the cache with.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.settings import SystemSetting

#: ``system_settings`` keys. Prefixed, because that table has one flat
#: namespace and no other grouping.
KEY_CHAT_MODEL = "ai_chat_model"
KEY_REASONING_MODEL = "ai_reasoning_model"
KEY_MAX_TOOL_STEPS = "ai_max_tool_steps"

KEYS: tuple[str, ...] = (KEY_CHAT_MODEL, KEY_REASONING_MODEL, KEY_MAX_TOOL_STEPS)

#: A model id is opaque to us — it is whatever OpenAI decided to call the thing
#: — so it is length- and charset-bounded rather than checked against a list.
#: Long enough for a dated snapshot like ``gpt-4o-mini-2024-07-18``.
MODEL_ID_MAX_LENGTH = 64

#: Everything OpenAI has ever named a model, and nothing that could break the
#: request it is pasted into: no whitespace, no newline, no quote.
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]+$")

#: The tool-step ceiling exists to stop a looping model from spending money.
#: One means "answer, never call a tool"; past ten the loop is not working, it
#: is stuck, and each extra step is another paid round trip.
MIN_TOOL_STEPS = 1
MAX_TOOL_STEPS = 10

#: Offered to the panel so the model can be picked from a list instead of typed
#: from memory. It is a convenience, NOT a whitelist: :func:`store` accepts any
#: id that passes the length and charset check, because OpenAI ships models far
#: more often than we redeploy and a list is stale the week after it is written.
#: ``tier`` is a hint for the panel to group by, not something we enforce.
KNOWN_MODELS: tuple[dict[str, str], ...] = (
    {"id": "gpt-4o-mini", "tier": "fast"},
    {"id": "gpt-4.1-nano", "tier": "fast"},
    {"id": "gpt-4.1-mini", "tier": "fast"},
    {"id": "gpt-4o", "tier": "balanced"},
    {"id": "gpt-4.1", "tier": "balanced"},
    {"id": "gpt-5-mini", "tier": "balanced"},
    {"id": "gpt-5", "tier": "reasoning"},
    {"id": "o4-mini", "tier": "reasoning"},
)

#: How long a read of the three rows is reused. Short on purpose: this is what
#: carries a change made in the panel to the *other* worker processes, which
#: never see the PATCH and so never invalidate anything. Half a minute of one
#: worker still using the previous model is a shrug; a stale model until the
#: next deploy is the problem this whole module exists to remove.
CACHE_TTL_SECONDS = 30.0

_rows: dict[str, str] = {}
_rows_read_at: float = 0.0
_rows_loaded = False


@dataclass(frozen=True, slots=True)
class AiSettings:
    """The values in force right now, and where each of them came from.

    ``sources`` is not decoration. A panel that shows ``gpt-4o-mini`` without
    saying whether that is a stored choice or the deployed default cannot
    answer the only question anyone asks of this screen — "did my change take?"
    Each entry is one of:

    ``stored``    a ``system_settings`` row supplied it;
    ``env``       no row, so the environment variable did;
    ``inherited`` reasoning model only: neither, so it mirrors the everyday
                  model, which is what ``settings.openai_model_smart`` has
                  always done.
    """

    chat_model: str
    reasoning_model: str
    max_tool_steps: int
    sources: dict[str, str]

    def as_payload(self) -> dict[str, Any]:
        """The wire shape. camelCase, like every other admin response."""
        return {
            "chatModel": self.chat_model,
            "reasoningModel": self.reasoning_model,
            "maxToolSteps": self.max_tool_steps,
            "sources": {
                "chatModel": self.sources["chat_model"],
                "reasoningModel": self.sources["reasoning_model"],
                "maxToolSteps": self.sources["max_tool_steps"],
            },
        }


def _compose(rows: dict[str, str]) -> AiSettings:
    """Fold stored rows over the environment. Never reads the database."""
    stored_chat = (rows.get(KEY_CHAT_MODEL) or "").strip()
    stored_reasoning = (rows.get(KEY_REASONING_MODEL) or "").strip()
    stored_steps = (rows.get(KEY_MAX_TOOL_STEPS) or "").strip()

    chat_model = stored_chat or settings.OPENAI_MODEL
    if stored_reasoning:
        reasoning_model = stored_reasoning
        reasoning_source = "stored"
    elif settings.OPENAI_MODEL_SMART:
        reasoning_model = settings.OPENAI_MODEL_SMART
        reasoning_source = "env"
    else:
        # No reasoning tier chosen anywhere: the smart calls run on the
        # everyday model, exactly as `settings.openai_model_smart` resolves it.
        reasoning_model = chat_model
        reasoning_source = "inherited"

    try:
        max_tool_steps = int(stored_steps) if stored_steps else settings.AI_MAX_TOOL_STEPS
    except ValueError:
        # A row that is not a number is a row somebody edited by hand in psql.
        # The ceiling is a spending guard, so fall back rather than crash the
        # turn it was supposed to protect.
        max_tool_steps = settings.AI_MAX_TOOL_STEPS
        stored_steps = ""
    max_tool_steps = max(MIN_TOOL_STEPS, min(MAX_TOOL_STEPS, max_tool_steps))

    return AiSettings(
        chat_model=chat_model,
        reasoning_model=reasoning_model,
        max_tool_steps=max_tool_steps,
        sources={
            "chat_model": "stored" if stored_chat else "env",
            "reasoning_model": reasoning_source,
            "max_tool_steps": "stored" if stored_steps else "env",
        },
    )


async def _read_rows(db: AsyncSession, *, force: bool = False) -> dict[str, str]:
    global _rows, _rows_read_at, _rows_loaded

    fresh = _rows_loaded and (time.monotonic() - _rows_read_at) < CACHE_TTL_SECONDS
    if fresh and not force:
        return _rows

    result = await db.execute(
        select(SystemSetting.key, SystemSetting.value).where(SystemSetting.key.in_(KEYS))
    )
    _rows = {key: value for key, value in result.all()}
    _rows_read_at = time.monotonic()
    _rows_loaded = True
    return _rows


async def load(db: AsyncSession | None, *, force: bool = False) -> AiSettings:
    """What the assistant should use for this turn.

    ``db`` may be ``None``, and then the answer comes from the cache — or from
    the environment, if nothing has been read yet. Which model to use is a
    *tuning* input to a turn, never a precondition for one: a caller that has
    no session to lend (the agent loop under test, a background job) must still
    get a usable answer rather than an exception in the middle of a reply.
    """
    if db is None:
        return cached()
    return _compose(await _read_rows(db, force=force))


def cached() -> AiSettings:
    """The same answer without a session, from whatever was last read.

    Falls back to the environment when nothing has been read yet, which is the
    behaviour this module replaced — so the worst case of never warming the
    cache is that the deploy-time configuration wins.
    """
    return _compose(_rows)


def invalidate() -> None:
    """Drop the cached rows so the next read hits the database.

    Called after a write, so the worker that took the PATCH does not keep
    serving the previous model for up to CACHE_TTL_SECONDS and make the
    superadmin think the save was ignored.
    """
    global _rows_loaded, _rows_read_at
    _rows_loaded = False
    _rows_read_at = 0.0


async def store(
    db: AsyncSession, values: dict[str, str | None]
) -> dict[str, dict[str, str | None]]:
    """Write the given ``system_settings`` rows and report what moved.

    ``values`` is keyed by the constants above. ``None`` deletes the row, which
    hands the setting back to the environment variable rather than pinning it
    to the value that variable happens to have today.

    Returns ``{key: {"from": old, "to": new}}`` for the keys that actually
    changed — the shape ``audit_log.record`` wants, and empty when the PATCH
    asked for what was already there. Flushed but not committed: the caller
    writes its audit rows into the same transaction, so a failure loses the
    change and the record of it together rather than one without the other.
    """
    existing = {
        row.key: row
        for row in (
            await db.execute(select(SystemSetting).where(SystemSetting.key.in_(KEYS)))
        ).scalars()
    }

    changes: dict[str, dict[str, str | None]] = {}
    for key, new_value in values.items():
        row = existing.get(key)
        old_value = row.value if row is not None else None
        if old_value == new_value:
            continue
        if new_value is None:
            if row is not None:
                await db.delete(row)
        elif row is not None:
            row.value = new_value
        else:
            db.add(SystemSetting(key=key, value=new_value))
        changes[key] = {"from": old_value, "to": new_value}

    if changes:
        await db.flush()
        invalidate()
    return changes
