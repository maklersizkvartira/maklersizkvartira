/**
 * Shield AI — the floating search assistant.
 *
 * The session key is issued by the server and kept in sessionStorage. The
 * previous build minted its own key (`sk-<random>-<timestamp>`) and stored it
 * in localStorage, which was both guessable and shared across tabs, so one
 * visitor could read another's conversation. The server now owns the key, the
 * transcript and the daily quota; this component only renders them.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, MessageSquare, RotateCcw, Send, Shield, Sparkles, X } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { AssistantApi } from '../../services/listingsApi';
import { ApiError } from '../../services/http';
import { useAppStore, type Filters } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { ListingCard } from '../listings/ListingCard';
import { Button } from '../ui/Field';

const SESSION_STORAGE_KEY = 'maklersiz.assistant.session';

const AUDIENCES = ['ALL', 'STUDENT', 'FAMILY'] as const;
const RENTAL_TYPES = ['ALL', 'FULL', 'ROOMMATE'] as const;

interface ChatMessage {
  id: number;
  from: 'ai' | 'me';
  text: string;
  listings?: Listing[];
}

type Phase = 'idle' | 'loading' | 'ready' | 'error';

let messageSequence = 0;

// The key is per-tab on purpose: a conversation is not something to restore in
// a browser the visitor has since handed to someone else.
function readStoredSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSession(key: string | null): void {
  try {
    if (key === null) sessionStorage.removeItem(SESSION_STORAGE_KEY);
    else sessionStorage.setItem(SESSION_STORAGE_KEY, key);
  } catch {
    /* private mode — the conversation lives for this page view only */
  }
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * The assistant returns only what it managed to extract from the sentence, so
 * a missing field leaves the user's existing filter alone instead of resetting
 * it to 'ALL' the way the previous version did.
 */
function toFilterPatch(need: Record<string, unknown>): Partial<Filters> {
  const patch: Partial<Filters> = {};

  const region = asText(need.region);
  if (region) patch.region = region;

  const district = asText(need.district);
  if (district) {
    patch.district = district;
    // The free-text box mirrors the district so the listings page shows the
    // same intent the assistant just acted on.
    patch.search = district;
  }

  const metroStation = asText(need.metroStation);
  if (metroStation) patch.metroStation = metroStation;

  const rooms = asCount(need.rooms);
  if (rooms !== undefined) patch.rooms = rooms;

  const maxPrice = asCount(need.maxPrice);
  if (maxPrice !== undefined) patch.maxPrice = maxPrice;

  const audience = asOneOf(need.audience, AUDIENCES);
  if (audience) patch.audience = audience;

  const rentalType = asOneOf(need.rentalType, RENTAL_TYPES);
  if (rentalType) patch.rentalType = rentalType;

  return patch;
}

export const ShieldMascot: React.FC = () => {
  const { t } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<{ limit: number; remaining: number } | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const limitReached = quota !== null && quota.remaining <= 0;

  const append = useCallback((message: Omit<ChatMessage, 'id'>) => {
    setLog((previous) => [...previous, { ...message, id: ++messageSequence }]);
  }, []);

  const welcome = useCallback(
    (): ChatMessage => ({
      id: ++messageSequence,
      from: 'ai',
      text: currentUser?.name
        ? t('assistant.chat.welcomeNamed', { name: currentUser.name })
        : t('assistant.chat.welcome'),
    }),
    [currentUser?.name, t],
  );

  const startSession = useCallback(async () => {
    setPhase('loading');
    try {
      const existing = readStoredSession();
      if (existing) {
        try {
          const history = await AssistantApi.history(existing);
          setQuota({ limit: history.limit, remaining: history.remaining });
          setLog(
            history.messages.length > 0
              ? history.messages.map((entry) => ({
                  id: ++messageSequence,
                  from: entry.role === 'user' ? ('me' as const) : ('ai' as const),
                  text: entry.content,
                }))
              : [welcome()],
          );
          setPhase('ready');
          return;
        } catch {
          // Expired or unknown key: drop it and ask the server for a fresh one.
          writeStoredSession(null);
        }
      }

      const created = await AssistantApi.createSession();
      writeStoredSession(created.sessionKey);
      setQuota({ limit: created.limit, remaining: created.remaining });
      setLog([welcome()]);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [welcome]);

  useEffect(() => {
    if (open && phase === 'idle') void startSession();
  }, [open, phase, startSession]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, sending]);

  useEffect(() => {
    if (open && phase === 'ready') inputRef.current?.focus();
  }, [open, phase]);

  // Escape closes the confirmation first, then the panel — the usual layering.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showCloseConfirm) setShowCloseConfirm(false);
      else setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, showCloseConfirm]);

  const send = async () => {
    const message = text.trim();
    if (!message || sending || limitReached) return;

    const sessionKey = readStoredSession();
    if (!sessionKey) {
      setPhase('error');
      return;
    }

    append({ from: 'me', text: message });
    setText('');
    setSending(true);

    try {
      const response = await AssistantApi.send(sessionKey, message, currentUser?.name ?? undefined);
      setQuota({ limit: response.limit, remaining: response.remaining });

      if (response.status === 'limit_reached') {
        append({ from: 'ai', text: t('assistant.chat.limitReached') });
        return;
      }
      if (response.status !== 'success') {
        append({ from: 'ai', text: t('assistant.chat.replyFailed') });
        return;
      }

      append({
        from: 'ai',
        text: response.reply,
        listings: response.listings?.length ? response.listings : undefined,
      });

      if (response.need) {
        const patch = toFilterPatch(response.need);
        if (Object.keys(patch).length > 0) setFilters(patch);
      }
    } catch (error) {
      append({
        from: 'ai',
        text:
          error instanceof ApiError && error.isNetwork
            ? t('assistant.chat.networkFailed')
            : t('assistant.chat.replyFailed'),
      });
    } finally {
      setSending(false);
    }
  };

  const endConversation = async () => {
    setShowCloseConfirm(false);
    setOpen(false);

    const sessionKey = readStoredSession();
    // Only a conversation the visitor actually took part in is worth summarising.
    if (sessionKey && log.some((message) => message.from === 'me')) {
      try {
        await AssistantApi.close(sessionKey);
      } catch {
        /* the summary is best-effort; the visitor is already gone */
      }
    }

    writeStoredSession(null);
    setLog([]);
    setQuota(null);
    setPhase('idle');
  };

  const openListing = (listing: Listing) => {
    // The detail view reads from the store, so a listing that so far exists
    // only inside this conversation has to be seeded before we navigate.
    if (!useAppStore.getState().listings.some((item) => item.id === listing.id)) {
      useAppStore.setState((state) => ({ listings: [listing, ...state.listings] }));
    }
    setCurrentView('LISTING_DETAIL', listing.id);
    setOpen(false);
  };

  const typingDots = (
    <>
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />
    </>
  );

  return (
    <div className={`pointer-events-auto fixed z-40 ml-auto max-w-full sm:bottom-6 sm:left-auto sm:right-6 sm:w-105 md:w-120 ${open ? "bottom-20 left-2 right-2" : "bottom-24 right-4"}`}>
      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-xs"
          onClick={() => setShowCloseConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-close-title"
            className="w-full max-w-xs space-y-4 rounded-3xl border border-line bg-surface p-6 text-center shadow-raised"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-brand-text">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 id="assistant-close-title" className="text-base font-black text-content">
                {t('assistant.closeDialog.title')}
              </h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
                {t('assistant.closeDialog.description')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="secondary"
                fullWidth
                className="py-3 text-xs"
                onClick={() => setShowCloseConfirm(false)}
              >
                {t('assistant.closeDialog.cancel')}
              </Button>
              <Button
                fullWidth
                className="py-3 text-xs"
                onClick={() => {
                  void endConversation();
                }}
              >
                {t('assistant.closeDialog.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open ? (
        <div
          role="dialog"
          aria-label={t('assistant.mascot.panelLabel')}
          className="flex h-[70vh] max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-brand/40 bg-surface text-content shadow-raised sm:h-145 sm:rounded-3xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-line p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand-soft text-brand-text">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="flex items-center gap-1 text-base font-extrabold text-content">
                    {t('assistant.mascot.name')}
                    <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
                  </h4>
                  {quota && (
                    <span
                      title={t('assistant.chat.quotaLabel', {
                        remaining: quota.remaining,
                        limit: quota.limit,
                      })}
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-black ${
                        quota.remaining <= 2
                          ? 'border-danger/30 bg-danger-soft text-danger'
                          : 'border-brand/30 bg-brand-soft text-brand-text'
                      }`}
                    >
                      {t('assistant.chat.quota', {
                        remaining: quota.remaining,
                        limit: quota.limit,
                      })}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">{t('assistant.mascot.tagline')}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                aria-label={t('assistant.chat.reset')}
                title={t('assistant.chat.reset')}
                className="rounded-xl p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                aria-label={t('assistant.chat.close')}
                title={t('assistant.chat.close')}
                className="rounded-xl p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div
            role="log"
            aria-live="polite"
            aria-label={t('assistant.chat.log')}
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5"
          >
            {phase === 'loading' && (
              <div className="flex justify-center py-8">
                <div className="flex gap-2" aria-hidden="true">
                  {typingDots}
                </div>
                <span className="sr-only">{t('assistant.chat.loadingHistory')}</span>
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-center">
                <p className="text-xs font-semibold text-danger">
                  {t('assistant.chat.startFailed')}
                </p>
                <Button
                  variant="secondary"
                  className="py-2.5 text-xs"
                  onClick={() => {
                    void startSession();
                  }}
                >
                  {t('common.action.retry')}
                </Button>
              </div>
            )}

            {log.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                {message.from === 'ai' && (
                  <div className="mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-brand-text sm:h-8 sm:w-8">
                    <Shield className="h-4 w-4" aria-hidden="true" />
                  </div>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed wrap-break-word sm:p-4 sm:text-base ${
                    message.from === 'me'
                      ? 'rounded-tr-sm bg-brand font-medium text-on-brand'
                      : 'rounded-tl-sm border border-line bg-surface-2 text-content'
                  }`}
                >
                  <span className="sr-only">
                    {message.from === 'me' ? t('assistant.chat.you') : t('assistant.mascot.name')}
                  </span>
                  <div className="whitespace-pre-line wrap-break-word">{message.text}</div>

                  {message.listings && message.listings.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs font-bold text-muted">
                        {t('assistant.chat.resultsTitle')}
                      </p>
                      {message.listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} onOpen={openListing} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-brand-text">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-surface-2 p-3">
                  <span aria-hidden="true" className="flex gap-1.5">
                    {typingDots}
                  </span>
                  <span className="sr-only">{t('assistant.chat.thinking')}</span>
                </div>
              </div>
            )}

            {log.length > 1 && !sending && (
              <button
                type="button"
                onClick={() => {
                  setCurrentView('LISTINGS');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-xs font-medium text-brand-text transition-colors hover:bg-brand-soft-2"
              >
                {t('assistant.chat.viewAllResults')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <div ref={logEndRef} />
          </div>

          {/* Composer */}
          {limitReached && (
            <p className="shrink-0 border-t border-line bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
              {t('assistant.chat.limitReached')}
            </p>
          )}
          {!limitReached && quota && quota.remaining <= 2 && (
            <p className="shrink-0 border-t border-line bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
              {t('assistant.chat.quotaWarning', { count: quota.remaining })}
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-line p-3"
          >
            {/* A plain input rather than <TextInput>: this one needs a ref for
                focus-on-open, and the shared control does not forward one. */}
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={limitReached || sending || phase !== 'ready'}
              aria-label={t('assistant.chat.inputLabel')}
              placeholder={
                limitReached
                  ? t('assistant.chat.inputDisabled')
                  : sending
                    ? t('assistant.chat.inputThinking')
                    : t('assistant.chat.inputPlaceholder')
              }
              className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-xs font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={limitReached || sending || phase !== 'ready' || !text.trim()}
              aria-label={t('assistant.chat.send')}
              className="shrink-0 px-3.5 py-3"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('assistant.mascot.open')}
          className="group ml-auto flex items-center gap-3 rounded-full border border-brand/40 bg-surface p-2 text-content shadow-raised transition-all duration-300 hover:border-brand active:scale-95 sm:px-4 sm:py-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand/30 bg-brand-soft text-brand-text transition-transform group-hover:scale-110 sm:h-8 sm:w-8">
            <Shield className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
          </span>
          <span className="hidden flex-col text-left sm:flex">
            <span className="flex items-center gap-1 text-xs font-black text-content">
              {t('assistant.mascot.name')}
              <Sparkles className="h-3 w-3 text-brand-text" aria-hidden="true" />
            </span>
            <span className="text-[10px] font-bold text-muted">
              {t('assistant.mascot.shortTagline')}
            </span>
          </span>
          <span className="ml-1 hidden h-7 w-7 items-center justify-center rounded-full bg-brand text-on-brand sm:flex">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
};

export default ShieldMascot;
