'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { ApiError, http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminAiMessageRow, AdminAiSessionRow } from '@/shared/api/types';
import { formatPhone, shortId } from '@/shared/lib/mask';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusPill } from '@/shared/ui/StatusPill';
import { toast } from '@/shared/ui/Toast';
import { useAuthStore } from '@/store/auth.store';

/**
 * The live AI desk: a visitor's conversation with the assistant as it happens,
 * and the one control that stops the machine and puts a person in its place.
 *
 * `/ai` is the archive — a table of finished sessions, read for auditing.
 * This is the other half: the same conversations while they are still running,
 * with a takeover that flips `taken_over_by` on the session. From that moment
 * `POST /smart/assistant` short-circuits and answers the visitor with nothing
 * at all, so whatever is typed here is the only reply they will get. That is
 * why the composer is gated on holding the thread rather than merely being a
 * moderator, and why the release button exists at all.
 *
 * It is written as a deliberate diff against `/support`, the two-pane chat it
 * sits beside, keeping that screen's layout and dropping the four things it
 * learned the hard way:
 *
 *  · Polling is react-query's `refetchInterval` with
 *    `refetchIntervalInBackground: false`, not a `setInterval` plus a manual
 *    `document.visibilityState` guard. Doing both is how a tab ends up polling
 *    twice; doing neither is how a phone left on this screen hits an endpoint
 *    every three seconds all afternoon.
 *  · The thread query is keyed by session id, so a response that started
 *    before a thread switch cannot land in the pane it no longer belongs to.
 *    `/support` needs two refs to do that by hand.
 *  · A send invalidates; it never hand-appends. `/support` appended and
 *    de-duplicated by COUNT, so one message held twice left its local count
 *    permanently ahead of the server's and the operator silently stopped
 *    seeing incoming messages for the rest of the session.
 *  · The mobile back control renders above the loading and error branches, and
 *    its label is a message key. `/support` puts a hardcoded Uzbek literal in
 *    front of a Russian-speaking operator.
 */

/** The list moves slower than a thread and is the more expensive read. */
const LIST_POLL_MS = 6_000;
/** A live conversation. Fast enough that an operator does not refresh by hand. */
const THREAD_POLL_MS = 3_000;

/**
 * One page of conversations, and no Pagination control under it.
 *
 * This is a desk, not an archive: what matters is what is happening now, and
 * `AISession.created_at DESC` puts that on page one. Anyone who needs to walk
 * the whole history has `/ai`, which is paginated properly.
 */
const PAGE_SIZE = 50;

type ChatFilter = 'all' | 'liveOnly' | 'withLead';

/** Doubles as the `chat.*` message key for each tab — one string, no table. */
const FILTERS: readonly ChatFilter[] = ['all', 'liveOnly', 'withLead'];

/**
 * Who said it, and what their bubble looks like.
 *
 * Keyed loosely rather than by the `role` union so a role the panel has not
 * been taught yet renders as an ordinary assistant turn. `t()` throws on a key
 * that does not exist, and one unrecognised row must not take the whole
 * transcript down with it.
 */
const ROLE_KEY: Record<string, string> = {
  user: 'roleVisitor',
  assistant: 'roleAi',
  admin: 'roleAdmin',
};

/**
 * Operator right, visitor and AI left — the same hand `/support` uses, because
 * this is the screen an operator switches from. It deliberately breaks with
 * `AiTranscriptSheet`, which puts the visitor on the right: that is a two-way
 * flip, and three authors cannot be told apart by which side they sit on. The
 * role label above every bubble is what actually carries the meaning.
 */
const BUBBLE_BACKGROUND: Record<string, string> = {
  admin: 'var(--accent-subtle)',
  user: 'var(--color-surface-2)',
  assistant: 'var(--color-surface-3)',
};

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 2).toUpperCase();
}

export default function ChatPage() {
  const t = useTranslations('chat');
  const c = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();

  /** Whose takeover counts as ours. Null until the session bootstrap lands,
   *  which is the correct answer for "does this operator hold the thread". */
  const myAdminId = useAuthStore((state) => state.admin?.id ?? null);

  const [filter, setFilter] = useState<ChatFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminAiSessionRow | null>(null);
  const [reply, setReply] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const selectedId = selected?.id ?? null;

  /**
   * Which thread is on screen right now, readable from a mutation callback.
   *
   * H-FIX-9: takeover, release and send each resolve a round trip later, and
   * their callbacks wrote state unconditionally. An operator who moved on to
   * another conversation while one was in flight was yanked back to the thread
   * they had left (`setSelected(row)`), or had the reply they had just started
   * typing in the new one wiped out (`setReply('')`). Every callback below
   * compares the thread the mutation started on — which is the id it was
   * called with — against this ref, and touches no state when they differ.
   *
   * It is a ref rather than the `selectedId` those callbacks close over
   * because react-query captures a mutation's options at `mutate()` time: the
   * `onSuccess` that eventually runs is the one from the render that fired it,
   * and its `selectedId` is by definition the thread the operator has since
   * left. Written from an effect, not during render — the commit that changes
   * the selection lands long before any in-flight request resolves.
   */
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const conversations = useQuery({
    // The filter is in the key, so switching tabs is a different cache entry
    // rather than a refetch that briefly shows the previous tab's rows.
    queryKey: ['ai-conversations', filter],
    queryFn: ({ signal }) =>
      http.page<AdminAiSessionRow>(
        api.ai.sessions({
          page: 1,
          pageSize: PAGE_SIZE,
          // Bare route parameters, hence snake_case. Sending `takenOver` here
          // would be dropped by FastAPI without complaint and the tab would
          // quietly show every conversation.
          taken_over: filter === 'liveOnly' ? true : undefined,
          has_lead: filter === 'withLead' ? true : undefined,
        }),
        { signal },
      ),
    refetchInterval: LIST_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const rows = useMemo(() => conversations.data?.data ?? [], [conversations.data]);

  const messages = useQuery({
    queryKey: ['ai-messages', selectedId],
    queryFn: ({ signal }) =>
      http.get<AdminAiMessageRow[]>(
        // `mark_read` is opt-in and snake_case — a bare route parameter, so
        // `markRead` would be dropped by FastAPI and the thread would stay
        // unread forever. This screen is the one place where opening a
        // conversation genuinely means an operator has read it, so it is the
        // one caller that asks for the write; `/ai`'s read-only transcript
        // sheet leaves it off and no longer zeroes this desk's unread badges
        // just because someone audited a session (H-FIX-6).
        api.ai.sessionMessages(selectedId!, { mark_read: true }),
        { signal },
      ),
    enabled: selectedId !== null,
    refetchInterval: THREAD_POLL_MS,
    refetchIntervalInBackground: false,
  });

  /**
   * The row the right pane is drawn from: the list's live copy while it is
   * still in the list, the tapped row otherwise.
   *
   * Both halves matter. Preferring the list is what makes a takeover by
   * another desk appear here within one poll instead of leaving a stale
   * "hand back" button on screen. Falling back to the tapped row is what keeps
   * an open thread on screen when a filter tab or a search stops matching it —
   * deriving it from the list alone would empty the pane out from under
   * whoever is typing in it.
   */
  const thread = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? selected,
    [rows, selectedId, selected],
  );

  const heldByMe = Boolean(thread?.takenOverBy && thread.takenOverBy === myAdminId);
  const heldByOther = Boolean(thread?.takenOverBy && thread.takenOverBy !== myAdminId);

  /**
   * The lead on this thread was captured but never reached the Telegram group
   * (L-FIX-1). Strictly `=== false`: `null` means there is no lead, or the
   * session predates the column, and neither is a warning.
   */
  const leadUndelivered = thread?.leadDelivered === false;

  const clock = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );
  const stamp = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  /** Client-side, over the page already fetched — the route has no `search`. */
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.userName, row.guestLabel, row.leadName, row.leadPhone, row.sessionKey, row.summary].some(
        (field) => field?.toLowerCase().includes(query),
      ),
    );
  }, [rows, search]);

  // Keyed on the thread as well as the message count: two conversations that
  // happen to hold the same number of messages would otherwise open at the
  // previous one's scroll offset, halfway up somebody else's history.
  useEffect(() => {
    if (!messages.data?.length) return;
    // `block: 'nearest'` keeps the scroll inside the transcript. Without it the
    // browser is free to move the document too, which yanks the whole shell
    // every time the poll brings in a message.
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId, messages.data?.length]);

  const takeover = useMutation({
    mutationFn: (sessionId: string) => http.post<AdminAiSessionRow>(api.ai.takeover(sessionId)),
    onSuccess: (row, startedOn) => {
      toast.success(t('takenOver'));
      // The invalidations run either way — the thread really is ours now and
      // both lists are stale wherever the operator happens to be looking.
      // Only the pane state is guarded (H-FIX-9).
      void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-messages', row.id] });
      if (selectedIdRef.current !== startedOn) return;
      setSelected(row);
    },
    onError: (error) => {
      // 409 is another desk getting there first, not a failure of ours. The
      // list is what is out of date, so refresh it — leaving the stale row on
      // screen means a button that will keep failing for the same reason.
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('errors.takeover'));
        void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
        return;
      }
      toast.error(c('error'));
    },
  });

  const release = useMutation({
    mutationFn: (sessionId: string) => http.post<AdminAiSessionRow>(api.ai.release(sessionId)),
    onSuccess: (row, startedOn) => {
      toast.success(t('released'));
      void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-messages', row.id] });
      if (selectedIdRef.current !== startedOn) return;
      setSelected(row);
    },
    onError: () => toast.error(c('error')),
  });

  const send = useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      http.post<AdminAiMessageRow>(api.ai.sendMessage(sessionId), { content }),
    onSuccess: (_message, variables) => {
      toast.success(t('sent'));
      // The composer belongs to whatever thread is open now. Clearing it after
      // the operator has switched away throws out a reply they are part-way
      // through writing to somebody else (H-FIX-9).
      if (selectedIdRef.current === variables.sessionId) setReply('');
      // Invalidated, never appended. With a 3s poll running, an optimistic
      // append has to de-duplicate by id — and the moment that is done by
      // count instead, the local total runs permanently ahead of the server's
      // and incoming messages stop rendering with nothing to show for it.
      void queryClient.invalidateQueries({ queryKey: ['ai-messages', variables.sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
    onError: (error) => {
      // The disabled composer is a courtesy; this 409 is the actual guard, and
      // it fires when the thread was released or stolen between render and
      // send. Say which of the two rules was broken rather than "failed".
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('errors.notTaken'));
        void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
        return;
      }
      toast.error(t('errors.send'));
    },
  });

  const canReply = heldByMe && selectedId !== null;

  const handleSend = () => {
    const content = reply.trim();
    if (!content || !selectedId || !canReply || send.isPending) return;
    send.mutate({ sessionId: selectedId, content });
  };

  const toggleTakeover = () => {
    if (!thread || takeover.isPending || release.isPending) return;
    if (heldByMe) release.mutate(thread.id);
    else takeover.mutate(thread.id);
  };

  return (
    // Verbatim from /support, and for the same reason: DashboardLayout already
    // offsets every page by --header-height and pads it asymmetrically, so this
    // page subtracts exactly that and adds none of its own. pt-8 + pb-6rem =
    // 8rem below 1024px; lg:pt-12 + pb-6rem = 9rem at exactly 1024px, where the
    // mobile dock's own max-width query still applies; lg:pt-12 +
    // min-[1025px]:pb-12 = 6rem above it. 100dvh rather than 100vh so mobile
    // browser chrome does not eat another 60-100px on top.
    <div className="flex h-[calc(100dvh-var(--header-height)-8rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--header-height)-9rem-env(safe-area-inset-bottom))] min-[1025px]:h-[calc(100dvh-var(--header-height)-6rem)] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent)', color: '#ffffff' }}
          >
            <Bot size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-xl font-bold leading-tight"
              style={{
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-heading)',
              }}
            >
              {t('title')}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {t('subtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void conversations.refetch();
            void messages.refetch();
          }}
          disabled={conversations.isFetching}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <RefreshCw size={14} className={cn(conversations.isFetching && 'animate-spin')} />
          {t('refresh')}
        </button>
      </div>

      <div className="card flex min-h-0 flex-1 overflow-hidden">
        {/* Master. Below md it owns the whole panel until a conversation is
            tapped, then it steps aside for the thread; from md up both halves
            are on screen at once. */}
        <div
          className={cn(
            'w-full flex-col md:w-80 lg:w-96',
            selectedId ? 'hidden md:flex' : 'flex',
          )}
          style={{ borderRight: '1px solid var(--color-border)' }}
        >
          <div
            className="shrink-0 space-y-2.5 p-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div
              className="grid grid-cols-3 gap-1 rounded-xl p-1"
              style={{ background: 'var(--color-surface-2)' }}
            >
              {FILTERS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className="rounded-lg py-1.5 text-center text-xs font-medium transition-colors"
                  style={
                    filter === tab
                      ? { background: 'var(--accent-subtle)', color: 'var(--accent)' }
                      : { color: 'var(--color-text-secondary)' }
                  }
                >
                  {t(tab)}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
              {/* text-base below md for the same reason globals.css bumps
                  .input-field to 16px: iOS Safari zooms any focused field under
                  16px and never zooms back, and on a phone this list is the
                  whole screen. */}
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                className="w-full rounded-xl py-2 pl-9 pr-3 text-base md:text-xs"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="flex justify-center p-8">
                <Spinner label={c('loading')} />
              </div>
            ) : conversations.isError ? (
              // Inline, not a toast. This query polls every six seconds, and a
              // backend that is down would otherwise stack a toast per tick
              // until the operator cannot see the panel at all.
              <div className="p-6 text-center">
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                  {t('errors.conversations')}
                </p>
                <button
                  type="button"
                  onClick={() => void conversations.refetch()}
                  className="mt-2 text-xs font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  {c('retry')}
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <MessageSquare size={26} style={{ color: 'var(--color-text-muted)' }} />
                <p
                  className="mt-2 text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t('noConversations')}
                </p>
              </div>
            ) : (
              visible.map((row) => {
                const isSelected = row.id === selectedId;
                const who = row.userName ?? row.guestLabel ?? c('unknown');

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelected(row);
                      // A half-typed reply belongs to the thread it was typed
                      // in, not to whichever one is opened next.
                      setReply('');
                    }}
                    className="flex w-full items-start gap-3 p-3.5 text-left transition-colors"
                    style={{
                      background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                      borderBottom: '1px solid var(--color-border-light)',
                    }}
                  >
                    <div className="relative shrink-0">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: 'var(--color-surface-3)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {initialsOf(who)}
                      </div>
                      {row.unreadCount > 0 && (
                        <span
                          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black"
                          style={{ background: 'var(--color-danger)', color: '#ffffff' }}
                        >
                          {row.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className="truncate text-xs font-bold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {who}
                        </p>
                        {row.lastMessageAt && (
                          <time
                            className="shrink-0 text-[10px]"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {clock.format(new Date(row.lastMessageAt))}
                          </time>
                        )}
                      </div>

                      <p
                        className="mt-0.5 truncate font-mono text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {shortId(row.sessionKey)}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {/* ACTIVE and INFO are enum names, not states this API
                            sends: they are how `statusVariant` resolves the
                            green and the accent, so the two pills here match
                            every other status colour in the panel. */}
                        {row.takenOverBy ? (
                          <StatusPill status="ACTIVE" label={t('roleAdmin')} pulse />
                        ) : (
                          <StatusPill status="INFO" label={t('roleAi')} />
                        )}
                        {row.leadPhone && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'var(--color-success-bg)',
                              color: 'var(--color-success)',
                            }}
                          >
                            <Phone size={10} aria-hidden="true" />
                            {formatPhone(row.leadPhone)}
                          </span>
                        )}
                        {/* L-FIX-1. `leadDelivered === false` — not falsy — is
                            the only case worth shouting about: null is "no
                            lead here", false is "the visitor was promised a
                            call back and the Telegram send failed, so nobody
                            on the team has been told". Nothing else in the
                            panel would ever surface that, and an operator
                            scanning this list is the last line of defence.

                            It sits inside the same flex-wrap strip as the
                            other pills and truncates rather than growing, so
                            on a phone it drops onto its own line instead of
                            widening the row and squeezing the name out. */}
                        {row.leadDelivered === false && (
                          <span
                            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: 'var(--color-warning-bg)',
                              color: 'var(--color-warning)',
                              border: '1px solid var(--color-warning-border)',
                            }}
                          >
                            <AlertTriangle size={10} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{t('leadUndelivered')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail. `hidden md:flex` with nothing selected, and a full screen
            with something selected — the inverse of the master beside it. */}
        <div className={cn('min-h-0 flex-1 flex-col', selectedId ? 'flex' : 'hidden md:flex')}>
          {/* Above every branch below, deliberately. While a thread is loading
              or has failed to load there is no thread header to hang a back
              control off, and on a phone this pane is the entire screen: that
              is exactly the dead end /support shipped. The label is a message
              key rather than the Uzbek literal /support still hardcodes. */}
          {selectedId && (
            <div
              className="flex shrink-0 items-center gap-2 px-2 py-2 md:hidden"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t('back')}
              </button>
            </div>
          )}

          {!thread ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div
                className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                <Bot size={30} strokeWidth={1.8} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {t('title')}
              </h3>
              <p
                className="mt-1 max-w-sm text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('selectConversation')}
              </p>
            </div>
          ) : (
            <>
              <div
                className="flex shrink-0 flex-wrap items-start justify-between gap-2 px-3 py-3 md:px-5"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      className="truncate text-sm font-bold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {thread.userName ?? thread.guestLabel ?? t('guest')}
                    </h2>
                    {thread.takenOverBy ? (
                      <StatusPill status="ACTIVE" label={t('roleAdmin')} pulse />
                    ) : (
                      <StatusPill status="INFO" label={t('aiActive')} />
                    )}
                  </div>

                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span className="font-mono">{shortId(thread.sessionKey)}</span>
                    <span aria-hidden="true">•</span>
                    <span>
                      {t('messages')}: {thread.messageCount}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>
                      {t('started')}: {stamp.format(new Date(thread.createdAt))}
                    </span>
                  </div>

                  {heldByOther && (
                    <p
                      className="mt-1 text-[11px] font-semibold"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      {t('takenOverBy', { name: thread.takenOverByName ?? c('unknown') })}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleTakeover}
                  disabled={heldByOther || takeover.isPending || release.isPending}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={
                    heldByMe
                      ? {
                          background: 'var(--color-warning-bg)',
                          color: 'var(--color-warning)',
                          border: '1px solid var(--color-warning-border)',
                        }
                      : {
                          background: 'var(--accent-subtle)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent-border)',
                        }
                  }
                >
                  {takeover.isPending || release.isPending ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : heldByMe ? (
                    <Sparkles size={13} aria-hidden="true" />
                  ) : (
                    <UserRound size={13} aria-hidden="true" />
                  )}
                  {heldByMe ? t('handBack') : t('takeOver')}
                </button>
              </div>

              {/* Only when there is a number to call. `capture_lead` writes
                  these onto the session the moment the visitor gives them, so
                  an operator taking the thread over already has the callback
                  in front of them rather than having to read it back out of
                  the transcript. */}
              {thread.leadPhone && (
                <div className="shrink-0 px-3 pt-3 md:px-5">
                  {/* The whole card turns from green to amber when the lead
                      never got out (L-FIX-1). A success-coloured card reads as
                      "handled", which is the opposite of the truth here, and
                      the operator reading it is the only person who now knows
                      this visitor is waiting for a call nobody scheduled. */}
                  <div
                    className="rounded-xl p-3"
                    style={
                      leadUndelivered
                        ? {
                            background: 'var(--color-warning-bg)',
                            border: '1px solid var(--color-warning-border)',
                          }
                        : {
                            background: 'var(--color-success-bg)',
                            border: '1px solid var(--color-success-border)',
                          }
                    }
                  >
                    {/* flex-wrap, so on a narrow phone the pill drops under
                        the heading instead of pushing the card sideways. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className="text-[11px] font-bold uppercase tracking-wide"
                        style={{
                          color: leadUndelivered
                            ? 'var(--color-warning)'
                            : 'var(--color-success)',
                        }}
                      >
                        {t('leadTitle')}
                      </p>
                      {leadUndelivered && (
                        <span
                          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: 'var(--color-surface)',
                            color: 'var(--color-warning)',
                            border: '1px solid var(--color-warning-border)',
                          }}
                        >
                          <AlertTriangle size={10} className="shrink-0" aria-hidden="true" />
                          <span className="truncate">{t('leadUndelivered')}</span>
                        </span>
                      )}
                    </div>
                    {leadUndelivered && (
                      <p
                        className="mt-1.5 text-[11px] font-semibold"
                        style={{ color: 'var(--color-warning)' }}
                      >
                        {t('leadUndeliveredHint')}
                      </p>
                    )}
                    <dl
                      className="mt-1.5 space-y-1 text-xs"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <div className="flex gap-2">
                        <dt className="shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                          {t('leadName')}
                        </dt>
                        <dd className="min-w-0 truncate font-semibold">
                          {thread.leadName ?? c('unknown')}
                        </dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                          {t('leadPhone')}
                        </dt>
                        <dd className="min-w-0">
                          <a
                            href={`tel:${thread.leadPhone}`}
                            className="font-semibold"
                            style={{ color: 'var(--accent)' }}
                          >
                            {formatPhone(thread.leadPhone)}
                          </a>
                        </dd>
                      </div>
                      {thread.leadNote && (
                        <div className="flex gap-2">
                          <dt className="shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                            {t('leadNote')}
                          </dt>
                          <dd className="min-w-0">{thread.leadNote}</dd>
                        </div>
                      )}
                      {thread.leadCapturedAt && (
                        <div className="pt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {stamp.format(new Date(thread.leadCapturedAt))}
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4">
                {messages.isLoading ? (
                  <div className="flex justify-center p-8">
                    <Spinner label={c('loading')} />
                  </div>
                ) : messages.isError ? (
                  <div className="p-6 text-center">
                    <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                      {t('errors.messages')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void messages.refetch()}
                      className="mt-2 text-xs font-semibold"
                      style={{ color: 'var(--accent)' }}
                    >
                      {c('retry')}
                    </button>
                  </div>
                ) : !messages.data?.length ? (
                  <p
                    className="p-8 text-center text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {t('noMessages')}
                  </p>
                ) : (
                  messages.data.map((message) => {
                    const mine = message.role === 'admin';

                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', mine ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className="max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%]"
                          style={{
                            background: BUBBLE_BACKGROUND[message.role],
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <div className="mb-1 flex items-baseline gap-2">
                            <span
                              className="text-[10px] font-bold"
                              style={{
                                color: mine ? 'var(--accent)' : 'var(--color-text-secondary)',
                              }}
                            >
                              {t(ROLE_KEY[message.role] ?? 'roleAi')}
                            </span>
                            <time
                              className="text-[10px]"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {clock.format(new Date(message.createdAt))}
                            </time>
                          </div>
                          <p
                            className="whitespace-pre-wrap text-xs leading-relaxed sm:text-sm"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-end gap-2">
                  {/* text-base below md, as above — a 12px composer is exactly
                      the field that triggers the iOS focus-zoom mid-reply. */}
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={2}
                    disabled={!canReply}
                    // The placeholder carries the reason it is disabled. A dead
                    // box with the ordinary "write your reply" prompt in it
                    // reads as a bug rather than as a missing takeover.
                    placeholder={canReply ? t('replyPlaceholder') : t('errors.notTaken')}
                    aria-label={t('replyPlaceholder')}
                    className="min-w-0 flex-1 resize-none rounded-xl p-2.5 text-base md:text-xs disabled:opacity-60"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canReply || !reply.trim() || send.isPending}
                    aria-label={t('send')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#ffffff' }}
                  >
                    {send.isPending ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
