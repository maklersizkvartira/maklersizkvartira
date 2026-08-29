'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, X } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminAiMessageRow, AdminAiSessionRow } from '@/shared/api/types';
import { shortId } from '@/shared/lib/mask';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Spinner } from '@/shared/ui/Spinner';

/**
 * One Shield AI conversation, read end to end.
 *
 * Three things about `GET /admin/ai/sessions/{id}/messages` shape this file:
 *
 *  · It takes the AISession's `id`, NOT its `sessionKey`. The key is the
 *    browser-side handle and looks equally uuid-ish, which is exactly why the
 *    row is passed in whole rather than an id string being assembled anywhere.
 *  · It is hard-capped at 200 rows with no truncation flag of any kind. A
 *    conversation of exactly 200 is therefore indistinguishable from a longer
 *    one that was cut, so the reader is told at 200 rather than guessed for.
 *  · An id that matches nothing answers 200 with `data: []` — the same body a
 *    genuinely empty session gives. The session row carries `messageCount`,
 *    which is the only thing that can tell those two apart, so it decides
 *    which of the two states below is drawn.
 */

const MESSAGE_CAP = 200;

const subscribeNever = () => () => {};

interface AiTranscriptSheetProps {
  session: AdminAiSessionRow | null;
  onClose: () => void;
}

export function AiTranscriptSheet({ session, onClose }: AiTranscriptSheetProps) {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale();

  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  const messages = useQuery({
    queryKey: ['ai-messages', session?.id],
    queryFn: ({ signal }) =>
      http.get<AdminAiMessageRow[]>(api.ai.sessionMessages(session!.id), { signal }),
    enabled: Boolean(session),
  });

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (session) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [session, onClose]);

  useEffect(() => {
    if (!session) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [session]);

  if (!session || !mounted) return null;

  const rows = messages.data ?? [];
  const capped = rows.length >= MESSAGE_CAP;
  /** Empty, but the session claims turns — the id resolved to nothing. */
  const missing = !messages.isLoading && rows.length === 0 && session.messageCount > 0;

  const who = session.userName ?? session.guestLabel ?? c('unknown');

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center md:p-4">
      <button
        type="button"
        aria-label={c('close')}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(5,11,22,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('messagesTitle')}
        className="relative w-full flex flex-col overflow-hidden
                   md:max-w-2xl md:rounded-[24px] md:animate-scale-in
                   max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-10
                   max-md:rounded-t-[28px] max-md:animate-slide-up-mobile"
        // No fixed height: a three-turn conversation should not open as a
        // half-empty box. On a phone the top/bottom insets above already give
        // the sheet a near-full-screen reading area.
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        <div
          className="md:hidden w-12 h-1 rounded-full mx-auto mt-3 shrink-0"
          style={{ background: 'var(--color-border-medium)' }}
        />

        <div
          className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {t('messagesTitle')}
            </h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
              {who} · <span className="font-mono">{shortId(session.sessionKey)}</span> ·{' '}
              {timeFormat.format(new Date(session.createdAt))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={c('close')}
            className="icon-btn flex w-11 h-11 md:w-8 md:h-8 -mt-1.5 -mr-1.5 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* The cap warning sits above the transcript, not below it: by the time
            a reader has scrolled to the end of 200 messages they have already
            decided the conversation stopped there. */}
        {capped && (
          <div
            className="flex items-start gap-2 px-5 py-2.5 text-xs shrink-0"
            style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{t('messagesCapped', { limit: MESSAGE_CAP })}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
          {messages.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" label={c('loading')} />
            </div>
          ) : messages.error ? (
            <EmptyState title={c('error')} description={messages.error.message} size="sm" />
          ) : missing ? (
            // Not "no messages": the session says it has turns, so an empty
            // body means the id no longer resolves, not that nobody spoke.
            <EmptyState title={c('error')} description={te('unknown')} size="sm" />
          ) : rows.length === 0 ? (
            <EmptyState title={t('noMessages')} size="sm" />
          ) : (
            <ol className="flex flex-col gap-3">
              {rows.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  stamp={timeFormat.format(new Date(message.createdAt))}
                  roleLabel={message.role === 'user' ? t('user') : t('assistant')}
                />
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Message({
  message,
  stamp,
  roleLabel,
}: {
  message: AdminAiMessageRow;
  stamp: string;
  roleLabel: string;
}) {
  const fromUser = message.role === 'user';

  return (
    <li className={`flex flex-col ${fromUser ? 'items-end' : 'items-start'}`}>
      <div className="flex items-baseline gap-2 mb-1 px-1">
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {roleLabel}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          {stamp}
        </span>
      </div>

      <div
        className="max-w-[85%] px-3.5 py-2.5 text-[13px] whitespace-pre-wrap break-words"
        style={{
          background: fromUser ? 'var(--accent-subtle)' : 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          borderBottomRightRadius: fromUser ? '4px' : undefined,
          borderBottomLeftRadius: fromUser ? undefined : '4px',
          color: 'var(--color-text-primary)',
        }}
      >
        {message.content}
      </div>

      {/* The listings the assistant cited in this turn. It is the only
          structured extra a message row carries — there is no tool-call
          column on `AIMessage` — so it is shown as what it is: ids. */}
      {message.listingIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%]">
          {message.listingIds.map((id) => (
            <span
              key={id}
              title={id}
              className="font-mono text-[10px] px-2 py-1 rounded-[var(--radius-xs)]"
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {shortId(id)}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
