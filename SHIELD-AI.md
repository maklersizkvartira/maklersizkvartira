# Shield AI — architecture

What the assistant is, how a turn runs, and which rules are enforced in code
rather than asked for in a prompt.

The Uzbek operator guide is `SEO-QADAMLAR.md`'s sibling: see §"Ishga tushirish"
at the end of this file for the two variables you may want to set.

---

## 1. What changed, and why

The assistant used to be two fixed model calls per turn — classify, then write
— with a database search wedged between them. That shape answers exactly one
kind of question ("find me a flat in Chilonzor") and cannot express anything
else, because the sequence of a turn was hardcoded. It could not save a
favourite, read an owner's own statistics, or hand a conversation to a person.

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
audited and serialised identically, and the owner's phone is stripped from
every row on the way out.

---

## 3. The tools

Ten, in three groups. Each declares a JSON schema, whether it needs an account,
which roles may call it, and whether it must ask first.

**For people looking for somewhere to live**

| Tool | Notes |
|---|---|
| `search_listings` | Delegates to `shield_ai.search_for_intent`; returns `matchQuality` so the model must say when a result was widened |
| `get_listing_details` | One row the visitor has already been shown |
| `add_favorite` | Signed in only |
| `remove_favorite` | Signed in only • **asks first** |
| `list_favorites` | Signed in only |

**For owners** — the half of `ai.md` that was never built

| Tool | Notes |
|---|---|
| `my_listings` | Status, trust score, views, favourites, contacts revealed |
| `listing_performance` | One listing against similar ones in the same district and room count, plus a **computed** list of what is holding it back |
| `how_tenants_search` | The real filter and sort list, so advice cannot drift into filters that do not exist |

**For reaching a person**

| Tool | Notes |
|---|---|
| `get_support_contacts` | The numbers in `SUPPORT_PHONES` |
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
check ownership again. A tenant account asking for `my_listings` is refused
twice over. Tools a caller may not use are also hidden from the schema list,
but that is for the conversation's sake, not for safety.

**Facts are computed.** `_advice_for` measures a listing: photo count, word
count, missing fields, trust score, views without contacts. It returns at most
six items and the model turns them into sentences. It does not decide what is
wrong with a listing, because it cannot see one.

**Consent is spent on the action it was given for.** A tool marked
`needs_confirmation` returns a pending action instead of running; the router
holds it in `agent_state` (server-side, so it cannot be forged in a request
body) and replays it only when the next message plainly says yes.
`_is_approved` matches the tool *and* its arguments, so agreeing to one thing
never authorises the next.

---

## 5. Failure

Everything degrades to the deterministic path. No API key, a timeout, a rate
limit, a 400, a malformed reply, a tool that raises — each ends with `None` or
a partial result, and the old two-pass pipeline writes the answer. Below that
sits the template layer, which needs no model at all.

A tool that refuses does not raise into the response: its message goes back to
the model as a tool result, so "the visitor is not signed in" becomes a
sentence in their own language rather than a 403.

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
| `SUPPORT_PHONES` | the two published numbers | Comma-separated. What the assistant hands out when someone asks for a person. |

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
4. **Owner listings that are not public do not render as cards.** The text
   describes them; the card rail only shows what a tenant could also see.
