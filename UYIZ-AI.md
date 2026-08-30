# Uyiz AI — architecture

What the assistant is, how a turn runs, and which rules are enforced in code
rather than asked for in a prompt.

The Uzbek operator guide is `SEO-QADAMLAR.md`'s sibling: see §"Ishga tushirish"
at the end of this file for the two variables you may want to set.

---

## 0. What Uyiz AI says it is

Uyiz is an apartment and room rental marketplace in Uzbekistan. Private owners
**and professional real-estate agents** both publish; renters browse and
contact whoever published a listing directly. Publishing a listing is free,
browsing and getting in touch are free, and Uyiz takes no cut of the rent.

Every listing carries a **reliability percentage**. It starts full and falls
only when somebody reports the listing and an administrator confirms that
report. Anyone can report a listing. Nothing is scored at publication time.

Two claims the assistant used to make are now false and must not come back:
that the platform excludes brokers or charges 0% commission, and that an
automatic risk check screens listings before they go public. The persona lives
in three places and all three carry the current story — see §5.

---

## 1. What changed, and why

The assistant used to be two fixed model calls per turn — classify, then write
— with a database search wedged between them. That shape answers exactly one
kind of question ("find me a flat in Chilonzor") and cannot express anything
else, because the sequence of a turn was hardcoded. It could not save a
favourite, read a publisher's own statistics, or hand a conversation to a
person.

It is now an **agent loop with tools**. The model decides which actions a turn
needs and in what order; the actions live in `app/services/ai_tools.py` and are
the only way it can touch data.

The old pipeline is not gone. It is the fallback, and the search tool calls
straight back into its `search_for_intent`, so the district logic and the
loosening ladder are shared rather than duplicated.

---

## 2. One turn, end to end

```
POST /api/v1/smart/assistant
  │
  ├─ rate limit + daily quota          (unchanged; DEVELOPER exempt)
  ├─ load session, load last 20 messages
  ├─ is there a pendingAction?
  │     "ha"  → run it now, tell the model the result
  │     "yo'q"→ tell the model it was declined
  │     else  → drop it and treat the message as new
  │
  ├─ ai_agent.run_turn()
  │     ├─ build system prompt (who is asking, what language, first turn?)
  │     ├─ history: last 8 turns verbatim, older folded into one line
  │     ├─ loop, up to AI_MAX_TOOL_STEPS:
  │     │     model → tool calls? → run them → feed results back
  │     │     needs confirmation? → stop, return the question
  │     └─ model → text → done
  │
  ├─ reply produced?  → _finish()
  └─ reply is None?   → the old two-pass path, then _finish()
```

`_finish` is shared. Whichever path wrote the words, the turn is stored,
audited and serialised identically, and the publisher's phone is stripped
from every row on the way out.

---

## 3. The tools

Ten, in three groups. Each declares a JSON schema, whether it needs an account,
which roles may call it, and whether it must ask first.

**For people looking for somewhere to live**

| Tool | Notes |
|---|---|
| `search_listings` | Delegates to `uyiz_ai.search_for_intent`; twenty filter parameters, not six; returns `matchQuality` and `droppedCriteria` so the model must say when a result was widened |
| `get_listing_details` | One row the visitor has already been shown |
| `add_favorite` | Signed in only |
| `remove_favorite` | Signed in only • **asks first** |
| `list_favorites` | Signed in only |

**For publishers** — owners and professional agents alike

| Tool | Notes |
|---|---|
| `my_listings` | Status, reliability percentage, views, favourites, contacts revealed |
| `listing_performance` | One listing against similar ones in the same district and room count, plus a **computed** list of what is holding it back |
| `how_tenants_search` | The real filter and sort list, so advice cannot drift into filters that do not exist |

**For reaching a person**

| Tool | Notes |
|---|---|
| `get_support_contacts` | The numbers in `SUPPORT_PHONES`, plus `SUPPORT_TELEGRAM` and `SUPPORT_HOURS`. Never a literal in the source; an unset route is omitted, not blank |
| `request_support_callback` | Validates the number, pages the Telegram group • **asks first** |

---

## 4. The four rules that are code, not prompt

A prompt is guidance. These are guarantees.

**The model never names a row.** It refers to a listing by the position it was
shown in — 1, 2, 3 — and `_resolve_listing` turns that into an id using
`agent_state.shownIds`, which only the server writes. A model that hallucinates
a UUID gets an error, not somebody else's apartment. A new result set replaces
that list, so "save the second one" always means the second one on screen.

**Permission is checked in `execute`, before the handler runs**, and the
handlers then call the same service functions the HTTP routers call — which
check ownership again. A renter account asking for `my_listings` is refused
twice over. Tools a caller may not use are also hidden from the schema list,
but that is for the conversation's sake, not for safety.

**Facts are computed.** `_advice_for` measures a listing: photo count, word
count, missing fields, reliability percentage, views without contacts. It returns at most
six items and the model turns them into sentences. It does not decide what is
wrong with a listing, because it cannot see one.

**Consent is spent on the action it was given for.** A tool marked
`needs_confirmation` returns a pending action instead of running; the router
holds it in `agent_state` (server-side, so it cannot be forged in a request
body) and replays it only when the next message plainly says yes.
`_is_approved` matches the tool *and* its arguments, so agreeing to one thing
never authorises the next.

---

## 4b. What the search can actually reach

`search_listings` used to expose six parameters — district, region, rooms,
max_price, audience, rental_type — while `ListingFilters` implemented twenty.
A visitor asking for "mebelli, metro yaqin, kamida 60 m²" got an unfiltered
list and no indication that three of their conditions had been ignored.

It now passes through everything `ListingFilters` supports: `metro_station`,
`university_name`, `property_type`, `min_area`, `min_price`, `roommate_gender`,
`furnished`, `parking`, `internet`, `air_conditioning`, `washing_machine`,
`pets_allowed`, `only_verified` and `sort_by`. No SQL was written for any of
it — `services/listings.apply_filters` already had every clause; the change is
that `SearchIntent` and `search_for_intent` now carry the fields to it.

Three things are deliberately **not** exposed:

- **`min_trust_score`.** The reliability percentage only moves when an
  administrator confirms a report, so a searchable filter on it would turn a
  moderation outcome into a public ranking facet.
- **The `TRUST` sort order**, for the same reason.
- **A `false` on any amenity.** The catalogue has no "must not have a washing
  machine" clause; `_safe_wanted` folds `false` into "did not ask", because a
  literal false would either do nothing or hide listings they would have taken.

There is also no `max_area`: `ListingFilters` has only `min_area`, so "60 m²
gacha" is unrepresentable anywhere in the system. The regex parser therefore
reads an area as a minimum **only** when the message says so ("kamida 60 m²"),
rather than guessing.

**The loosening ladder, in order.** Preferences first and all at once — nobody
would rather see an empty screen than a flat without a washing machine. Then
the budget, stretched ×1.4 before it is abandoned. Then the room count. Then
audience and rental type. The district is never dropped here at all; the
neighbour search handles that separately. Whatever a step gave up is recorded
in `intent.dropped`, surfaced to the model as `droppedCriteria` and stated
outright in the deterministic reply, so a loosened result is never presented
as an exact one. The whole ladder is capped at six steps plus four neighbour
queries: every step is a real database round trip inside a chat turn.

**A metro station is only read when the word "metro" or "bekat" is present.**
Seven stations share a name with the district around them — Chilonzor,
Sergeli, Olmazor, Yunusobod among them — so an unguarded match would silently
add a filter nobody asked for and hide every listing in Chilonzor that is not
beside the station.

---

## 4c. Reaching a person

The handoff is a first-class path, not a last resort, and it works on both
paths:

- **Agent path.** `get_support_contacts` returns the numbers from
  `SUPPORT_PHONES`; `request_support_callback` validates the number, pages the
  Telegram group and asks for confirmation first. The prompt tells the model to
  offer both routes whenever the visitor is stuck, unhappy, asking for
  something it cannot do, or asking for a person.
- **No-key path.** `MessageKind` gained `CONTACT`, matched by a deliberately
  narrow regex (operator, support, menejer, живой человек, speak to a person —
  never a bare "telefon", which means a listing's number). It outranks SEARCH
  even when the same sentence names a district: answering "operatoringiz bilan
  gaplashay" with apartments is the failure this branch exists to prevent.
  `TEMPLATES["contact"]` carries the numbers in all three languages.

The numbers are never a literal in the source. Both paths read
`uyiz_ai.support_phone_list()`, which reads `settings.support_phones`.

**Known gap:** `request_support_callback` returns `{"recorded": True}` whether
or not Telegram accepted the message — `telegram.send_message` returns `False`
silently when `TELEGRAM_BOT_TOKEN` or `TELEGRAM_GROUP_ID` is unset. The tool
does report `deliveredToTeam`, but nothing persists the request as a row and
there is no admin-panel queue for it. See §8.

---

## 5. Failure

Everything degrades to the deterministic path. No API key, a timeout, a rate
limit, a 400, a malformed reply, a tool that raises — each ends with `None` or
a partial result, and the old two-pass pipeline writes the answer. Below that
sits the template layer, which needs no model at all.

A tool that refuses does not raise into the response: its message goes back to
the model as a tool result, so "the visitor is not signed in" becomes a
sentence in their own language rather than a 403.

**The persona lives in three places and they must move together.**
`ai_agent.build_system_prompt` is the live path; `uyiz_ai._understand_prompt`
and `_compose_prompt` are the fallback; `uyiz_ai.TEMPLATES` is the layer below
that, which needs no model at all. Changing only the agent prompt produces an
assistant that is correct until OpenAI has a bad minute — at which point it
introduces itself under the old brand and states the old positioning. This
split is the single most likely way a rebrand ships broken.

Temperature is retried away rather than guessed at — some model families reject
any value but the default, so a 400 mentioning `temperature` drops it and
retries once. That keeps this working across a model swap nobody remembered to
tell the file about.

---

## 6. Cost and context

- **Model tiering.** The first call of a turn is routing — cheap work, runs on
  `OPENAI_MODEL`. Once a tool has returned, the turn is reasoning, and later
  calls run on `OPENAI_MODEL_SMART`. Unset, both are the same model and nothing
  changes.
- **History.** Last 8 turns verbatim; older *user* turns folded into one line
  under 600 characters. Assistant turns are dropped from the fold — their
  content is reconstructable from what the tools return. Any single message is
  truncated at 1500 characters.
- **Tool results** are capped at 6000 characters, listing rows at five per
  call, and user-written title/description at 120/200 characters.
- **Loop budget** is `AI_MAX_TOOL_STEPS` (4). On exhaustion the tools are
  withdrawn and one final call must answer in words.

---

## 7. Ishga tushirish (operator)

Two variables are worth knowing about. Both are optional.

| Variable | Default | What it does |
|---|---|---|
| `OPENAI_MODEL_SMART` | empty | The reasoning tier. Empty means everything runs on `OPENAI_MODEL`. Set it to a stronger model to get better answers on hard turns without paying for one on "salom". |
| `AI_MAX_TOOL_STEPS` | `4` | Tool round trips per turn. |
| `SUPPORT_PHONES` | the two published numbers | Comma-separated. What the assistant hands out when someone asks for a person — on the agent path *and* on the no-key path. |
| `SUPPORT_TELEGRAM` | `https://t.me/uyiz` | The written route, for people who would rather not call. Blank removes it from the offer entirely. |
| `SUPPORT_HOURS` | `09:00-21:00` | When a person is actually there. The assistant quotes it so an out-of-hours callback is promised for working hours rather than immediately. |

**A migration is required** before deploying: `alembic upgrade head` adds
`ai_sessions.agent_state`. Railway runs this on release; if it is skipped, the
agent path fails on every turn and the assistant silently falls back to the old
behaviour — correct, but with no actions.

---

## 8. What is deliberately left

1. **No streaming.** The reply arrives in one piece, so the chat can show that
   a search *ran* (`actions`, `steps`) but not that it *is running*. Live
   progress needs SSE on `/smart/assistant` and a reader on the client; it is a
   change to the endpoint contract, not a patch.
2. **No caching.** Two visitors asking the same thing pay for two searches. Worth
   doing when volume justifies it; today the daily quota is 10 per identity.
3. **`create_listing` / `update_listing` are not tools.** An owner can be told
   what to fix but not have the assistant fix it. Editing someone's live
   listing from a chat message is a bigger trust step than reading one, and it
   should wait until the read side has been used in anger.
4. **Publisher listings that are not public do not render as cards.** The text
   describes them; the card rail only shows what a renter could also see.
5. **No `max_area` filter.** `ListingFilters` has `min_area` only, so "60 m²
   gacha" cannot be expressed anywhere in the product. Adding it means a field
   on `ListingFilters`, a clause in `apply_filters`, and a control on the
   listings page — the AI is not the blocker.
6. **A callback is not a row.** `request_support_callback` pages the Telegram
   group and writes the generic `TELEGRAM_NOTIFIED` audit entry, and nothing
   else. There is no `SupportRequest` model, no dedicated `AuditAction`, and no
   admin-panel queue, so a callback is lost if nobody is reading Telegram — and
   the tool reports success either way when the bot is unconfigured.
7. **Search criteria are not remembered across turns as data.**
   `session.last_intent` is written every turn and read in only two places, and
   never reaches the model; continuity depends on the model re-reading the raw
   history. Passing it into `build_system_prompt` is the highest-value
   remaining improvement, and the one most easily got wrong — an inherited
   budget must be dropped the moment the visitor changes district.
8. **No tool for a Top request.** The assistant can explain Top and tell a
   publisher to request it from their listing; it cannot submit one.
