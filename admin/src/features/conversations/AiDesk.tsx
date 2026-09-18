'use client';

/**
 * The live AI desk: a visitor's conversation with the assistant as it
 * happens, and the one control that stops the machine and puts a person in
 * its place. The second tab of /conversations, in the same two-pane skin as
 * the support desk beside it.
 *
 * Everything the old /chat page learned stays: react-query polling that
 * pauses in a background tab, the thread query keyed by session id, a send
 * that invalidates and never hand-appends, the ref-guarded mutation
 * callbacks (H-FIX-9), the 409 branches, the lead card that turns amber when
 * the Telegram send failed (L-FIX-1), and a composer gated on holding the
 * thread rather than merely being a moderator.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeft, Bot, Phone, RefreshCw, Sparkles, UserRound } from 'lucide-react';

import { ApiError, http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminAiMessageRow, AdminAiSessionRow } from '@/shared/api/types';
import { formatPhone, shortId } from '@/shared/lib/mask';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/Toast';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/shared/lib/cn';

import {
  ChatBg,
  Composer,
  CountChip,
  DeskAvatar,
  GlassTabs,
  HeaderStatus,
  ListEmpty,
  ListError,
  ListLoading,
  ListSearch,
  MessageBubble,
  SparkGlyph,
  ThreadEmpty,
  UnreadBadge,
  formatClock,
  type BubbleSide,
} from './desk';

const LIST_POLL_MS = 6_000;
const THREAD_POLL_MS = 3_000;
/** A desk, not an archive: one page of the newest sessions. `/ai` paginates. */
const PAGE_SIZE = 50;

type ChatFilter = 'all' | 'liveOnly' | 'withLead';
const FILTERS: readonly ChatFilter[] = ['all', 'liveOnly', 'withLead'];

/** Which side and colour a role draws as; unknown roles render as AI turns. */
const ROLE_SIDE: Record<string, BubbleSide> = { user: 'user', assistant: 'ai', admin: 'operator' };

export interface AiDeskProps {
  /** When mounted inside the conversations hub: the source pills (support
   *  statuses + AI) drawn above the AI desk's own filters, with AI active. */
  sourceTabs?: { key: string; label: string }[];
  onSource?: (key: string) => void;
  /** Card title override — the hub keeps "Murojaatlar" across both desks. */
  listTitle?: string;
}

export function AiDesk({ sourceTabs, onSource, listTitle }: AiDeskProps = {}) {
  const t = useTranslations('chat');
  const c = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const myAdminId = useAuthStore((state) => state.admin?.id ?? null);

  const [filter, setFilter] = useState<ChatFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminAiSessionRow | null>(null);
  const [reply, setReply] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const selectedId = selected?.id ?? null;
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const conversations = useQuery({
    queryKey: ['ai-conversations', filter],
    queryFn: ({ signal }) =>
      http.page<AdminAiSessionRow>(
        api.ai.sessions({
          page: 1,
          pageSize: PAGE_SIZE,
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
    queryFn: ({ signal }) => http.get<AdminAiMessageRow[]>(api.ai.sessionMessages(selectedId!, { mark_read: true }), { signal }),
    enabled: selectedId !== null,
    refetchInterval: THREAD_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const thread = useMemo(() => rows.find((row) => row.id === selectedId) ?? selected, [rows, selectedId, selected]);
  const heldByMe = Boolean(thread?.takenOverBy && thread.takenOverBy === myAdminId);
  const heldByOther = Boolean(thread?.takenOverBy && thread.takenOverBy !== myAdminId);
  const leadUndelivered = thread?.leadDelivered === false;

  const stamp = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }), [locale]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.userName, row.guestLabel, row.leadName, row.leadPhone, row.sessionKey, row.summary].some((field) => field?.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  useEffect(() => {
    if (!messages.data?.length) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId, messages.data?.length]);

  const takeover = useMutation({
    mutationFn: (sessionId: string) => http.post<AdminAiSessionRow>(api.ai.takeover(sessionId)),
    onSuccess: (row, startedOn) => {
      toast.success(t('takenOver'));
      void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-messages', row.id] });
      if (selectedIdRef.current !== startedOn) return;
      setSelected(row);
    },
    onError: (error) => {
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
      if (selectedIdRef.current === variables.sessionId) setReply('');
      void queryClient.invalidateQueries({ queryKey: ['ai-messages', variables.sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('errors.notTaken'));
        void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
        return;
      }
      toast.error(t('errors.send'));
    },
  });

  const canReply = heldByMe && selectedId !== null;
  const busy = takeover.isPending || release.isPending;

  const handleSend = () => {
    const content = reply.trim();
    if (!content || !selectedId || !canReply || send.isPending) return;
    send.mutate({ sessionId: selectedId, content });
  };

  const toggleTakeover = () => {
    if (!thread || busy) return;
    if (heldByMe) release.mutate(thread.id);
    else takeover.mutate(thread.id);
  };

  const whoOf = (row: AdminAiSessionRow) => row.userName ?? row.guestLabel ?? t('guest');

  return (
    <div className="conv-wrap">
      {/* ══════ LEFT — sessions ══════ */}
      <div className={cn('conv-list-panel', selectedId && 'hidden-mobile')}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap' }}>
                {listTitle ?? t('listTitle')}
              </h2>
              {conversations.data && <CountChip value={rows.length} />}
            </div>
            <button
              type="button"
              onClick={() => {
                void conversations.refetch();
                void messages.refetch();
              }}
              disabled={conversations.isFetching}
              className="btn-circle-action"
              title={t('refresh')}
              aria-label={t('refresh')}
            >
              <RefreshCw size={13} className={cn(conversations.isFetching && 'animate-spin')} />
            </button>
          </div>

          <ListSearch value={search} onChange={setSearch} placeholder={t('search')} />
          {sourceTabs && onSource && <GlassTabs<string> tabs={sourceTabs} value="AI" onChange={onSource} />}
          <GlassTabs<ChatFilter> tabs={FILTERS.map((key) => ({ key, label: t(key) }))} value={filter} onChange={setFilter} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {conversations.isLoading ? (
            <ListLoading label={c('loading')} />
          ) : conversations.isError ? (
            <ListError message={t('errors.conversations')} retry={c('retry')} onRetry={() => void conversations.refetch()} />
          ) : visible.length === 0 ? (
            <ListEmpty title={t('noConversations')} />
          ) : (
            visible.map((row) => {
              const isSelected = row.id === selectedId;
              const who = whoOf(row);
              const unread = row.unreadCount > 0;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setSelected(row);
                    setReply('');
                  }}
                  className={cn('conv-list-item', isSelected && 'active')}
                >
                  <DeskAvatar name={who} dot={row.takenOverBy ? 'success' : 'accent'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          title={row.takenOverBy ? t('roleAdmin') : t('roleAi')}
                          style={{ display: 'inline-flex', color: row.takenOverBy ? '#10b981' : 'var(--accent)', flexShrink: 0 }}
                        >
                          {row.takenOverBy ? <UserRound size={13} /> : <SparkGlyph />}
                        </span>
                        <p
                          style={{
                            fontSize: 14.5,
                            fontWeight: unread ? 700 : 600,
                            margin: 0,
                            color: isSelected ? 'var(--accent)' : 'var(--color-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {who}
                        </p>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', flexShrink: 0 }}>{formatClock(row.lastMessageAt, locale)}</span>
                    </div>
                    <p className="font-mono" style={{ margin: 0, fontSize: 10.5, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shortId(row.sessionKey)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                        {row.leadPhone && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '1px 7px',
                              borderRadius: 9999,
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--color-success-bg)',
                              color: 'var(--color-success)',
                            }}
                          >
                            <Phone size={9} aria-hidden="true" />
                            {formatPhone(row.leadPhone)}
                          </span>
                        )}
                        {row.leadDelivered === false && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '1px 7px',
                              borderRadius: 9999,
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--color-warning-bg)',
                              color: 'var(--color-warning)',
                              border: '1px solid var(--color-warning-border)',
                              minWidth: 0,
                              maxWidth: '100%',
                            }}
                          >
                            <AlertTriangle size={9} style={{ flexShrink: 0 }} aria-hidden="true" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('leadUndelivered')}</span>
                          </span>
                        )}
                        {!row.leadPhone && row.leadDelivered !== false && (
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t('messages')}: {row.messageCount}
                          </span>
                        )}
                      </div>
                      {unread && <UnreadBadge count={row.unreadCount} />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══════ RIGHT — thread ══════ */}
      <div className={cn('conv-chat-panel', !selectedId && 'hidden-mobile')}>
        {!thread ? (
          <ThreadEmpty icon={<Bot size={36} strokeWidth={1.8} />} title={t('title')} hint={t('selectConversation')} />
        ) : (
          <>
            <div className="conv-chat-header">
              <button type="button" onClick={() => setSelected(null)} className="md:hidden btn-circle-action mobile-back" aria-label={t('back')}>
                <ArrowLeft size={16} />
              </button>

              <DeskAvatar name={whoOf(thread)} size={40} dot={thread.takenOverBy ? 'success' : 'accent'} />
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--color-text-primary)',
                      letterSpacing: '-0.01em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                      flex: '0 1 auto',
                    }}
                  >
                    {whoOf(thread)}
                  </p>
                  <span className="hidden md:inline font-mono" style={{ fontSize: 10.5, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                    {shortId(thread.sessionKey)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {heldByOther ? (
                    <HeaderStatus tone="warning" icon={<UserRound size={11} />}>
                      {t('takenOverBy', { name: thread.takenOverByName ?? c('unknown') })}
                    </HeaderStatus>
                  ) : heldByMe ? (
                    <HeaderStatus tone="success" icon={<UserRound size={11} />}>
                      {t('roleAdmin')}
                    </HeaderStatus>
                  ) : (
                    <HeaderStatus tone="accent" icon={<SparkGlyph />}>
                      {t('aiActive')}
                    </HeaderStatus>
                  )}
                  <span className="hidden sm:inline" style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {t('messages')}: {thread.messageCount} · {t('started')}: {stamp.format(new Date(thread.createdAt))}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {heldByMe ? (
                  <button type="button" onClick={toggleTakeover} disabled={busy} className="btn-pause-ai warning-static" title={t('handBack')}>
                    {busy ? <Spinner size="sm" label={c('loading')} /> : <Sparkles size={13} />}
                    <span className="btn-pause-ai-text">{t('handBack')}</span>
                  </button>
                ) : (
                  <button type="button" onClick={toggleTakeover} disabled={heldByOther || busy} className="btn-pause-ai active-glow" title={t('takeOver')}>
                    <span className="btn-pause-ai-inner">
                      {busy ? <Spinner size="sm" label={c('loading')} /> : <UserRound size={13} />}
                      <span className="btn-pause-ai-text">{t('takeOver')}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col" style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ChatBg />

              <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1, padding: '16px 12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Lead card — green when the callback reached the team,
                    amber when the Telegram send failed and the operator
                    reading this is the only one who knows (L-FIX-1). */}
                {thread.leadPhone && (
                  <div
                    style={{
                      marginBottom: 12,
                      borderRadius: 14,
                      padding: '10px 12px',
                      background: leadUndelivered ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                      border: `1px solid ${leadUndelivered ? 'var(--color-warning-border)' : 'var(--color-success-border)'}`,
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: leadUndelivered ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {t('leadTitle')}
                      </p>
                      {leadUndelivered && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '1px 8px',
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'var(--color-surface)',
                            color: 'var(--color-warning)',
                            border: '1px solid var(--color-warning-border)',
                          }}
                        >
                          <AlertTriangle size={10} aria-hidden="true" />
                          {t('leadUndelivered')}
                        </span>
                      )}
                    </div>
                    {leadUndelivered && (
                      <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 600, color: 'var(--color-warning)' }}>{t('leadUndeliveredHint')}</p>
                    )}
                    <dl style={{ margin: '6px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 3, fontSize: 12, color: 'var(--color-text-primary)' }}>
                      <dt style={{ color: 'var(--color-text-secondary)' }}>{t('leadName')}</dt>
                      <dd style={{ margin: 0, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.leadName ?? c('unknown')}</dd>
                      <dt style={{ color: 'var(--color-text-secondary)' }}>{t('leadPhone')}</dt>
                      <dd style={{ margin: 0 }}>
                        <a href={`tel:${thread.leadPhone}`} style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          {formatPhone(thread.leadPhone)}
                        </a>
                      </dd>
                      {thread.leadNote && (
                        <>
                          <dt style={{ color: 'var(--color-text-secondary)' }}>{t('leadNote')}</dt>
                          <dd style={{ margin: 0, minWidth: 0 }}>{thread.leadNote}</dd>
                        </>
                      )}
                      {thread.leadCapturedAt && (
                        <dd style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--color-text-muted)', fontSize: 11 }}>{stamp.format(new Date(thread.leadCapturedAt))}</dd>
                      )}
                    </dl>
                  </div>
                )}

                {messages.isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                    <Spinner size="lg" label={c('loading')} />
                  </div>
                ) : messages.isError ? (
                  <ListError message={t('errors.messages')} retry={c('retry')} onRetry={() => void messages.refetch()} />
                ) : !messages.data?.length ? (
                  <p style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{t('noMessages')}</p>
                ) : (
                  messages.data.map((message) => {
                    const side = ROLE_SIDE[message.role] ?? 'ai';
                    return (
                      <MessageBubble
                        key={message.id}
                        side={side}
                        label={side === 'ai' ? t('roleAi') : side === 'operator' ? t('roleAdmin') : null}
                        labelIcon={side === 'ai' ? <SparkGlyph /> : undefined}
                        time={formatClock(message.createdAt, locale)}
                      >
                        {message.content}
                      </MessageBubble>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              <Composer
                value={reply}
                onChange={setReply}
                onSend={handleSend}
                placeholder={t('replyPlaceholder')}
                sending={send.isPending}
                disabled={!canReply}
                disabledReason={heldByOther ? t('takenOverBy', { name: thread.takenOverByName ?? c('unknown') }) : t('errors.notTaken')}
                sendLabel={t('send')}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AiDesk;
