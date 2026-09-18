'use client';

/**
 * The support desk: customers who wrote to "Qo'llab-quvvatlash" on the
 * site, and the operator's replies to them. One of the two tabs of
 * /conversations, drawn in SotuvchiAi's two-pane conversations layout.
 *
 * The behaviour is the old /support page's, kept whole: the 2.5s thread poll
 * de-duplicated by message id, the 4s list poll, the visibility guard on
 * both, the ref-checked thread switch, the chime on an incoming customer
 * message, the OPEN/RESOLVED toggle, the global AI auto-reply switch and
 * the quick-reply chips. Only the paint changed.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Bot, CheckCircle2, Headphones, Phone, RefreshCw, RotateCcw, Shield } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import { toast } from '@/shared/ui/Toast';
import { IOSToggle } from '@/shared/ui/IOSToggle';
import { Spinner } from '@/shared/ui/Spinner';
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
  ListLoading,
  ListSearch,
  MessageBubble,
  ThreadEmpty,
  UnreadBadge,
  formatClock,
} from './desk';

export interface AdminSupportUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  role: string;
}

export interface AdminSupportConversation {
  id: string;
  user_id: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender: 'USER' | 'ADMIN' | null;
  unread_count: number;
  user: AdminSupportUser | null;
}

export interface AdminSupportMessage {
  id: string;
  conversation_id: string;
  sender_type: 'USER' | 'ADMIN';
  sender_id: string;
  /** The operator's name on an ADMIN message; absent on the seeded welcome. */
  sender_name?: string | null;
  text: string;
  created_at: string;
  read_at: string | null;
}

export interface AdminSupportDetail {
  id: string;
  user_id: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
  updated_at: string;
  unread_count: number;
  user: AdminSupportUser | null;
  messages: AdminSupportMessage[];
}

type StatusFilter = 'ALL' | 'OPEN' | 'RESOLVED';

/** The four canned replies, as message keys — the panel ships uz/ru/en. */
const QUICK_REPLY_KEYS = ['quick1', 'quick2', 'quick3', 'quick4'] as const;

export const playSupportNotificationSound = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Ignore audio errors
  }
};

export function SupportDesk() {
  const t = useTranslations('support');
  const c = useTranslations('common');
  const locale = useLocale();
  const myAdminId = useAuthStore((state) => state.admin?.id ?? null);

  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSupportDetail | null>(null);
  /** Which question each piece of loaded state is the ANSWER to — no
   *  booleans flipped inside effects, and no drift from the selection. */
  const [loadedStatus, setLoadedStatus] = useState<StatusFilter | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [togglingAi, setTogglingAi] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    http
      .get<{ enabled: boolean }>(api.support.aiStatus)
      .then((res) => {
        if (typeof res?.enabled === 'boolean') setAiEnabled(res.enabled);
      })
      .catch(() => null);
  }, []);

  const handleToggleAi = async (next: boolean) => {
    if (togglingAi) return;
    setTogglingAi(true);
    setAiEnabled(next);
    try {
      const res = await http.post<{ enabled: boolean; message?: string }>(api.support.toggleAi, { enabled: next });
      if (typeof res?.enabled === 'boolean') setAiEnabled(res.enabled);
      toast.success(next ? t('aiToggledOn') : t('aiToggledOff'));
    } catch {
      setAiEnabled(!next);
      toast.error(t('errors.status'));
    } finally {
      setTogglingAi(false);
    }
  };

  /** Which customer the pane is FOR, readable from a late callback. */
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedUserId;
  }, [selectedUserId]);
  const chatReqRef = useRef(0);

  /** Derived, not cleared: a mismatched thread is never on screen. */
  const activeDetail = detail && detail.user_id === selectedUserId ? detail : null;
  const loadingList = loadedStatus !== statusFilter || refreshing;
  const loadingChat = selectedUserId !== null && loadedUserId !== selectedUserId;

  const fetchConversations = (status: StatusFilter) =>
    http.get<AdminSupportConversation[]>(api.support.conversations({ status: status === 'ALL' ? undefined : status }));
  const fetchThread = (userId: string) => http.get<AdminSupportDetail>(api.support.messages(userId));

  const reloadConversations = async () => {
    setRefreshing(true);
    try {
      setConversations((await fetchConversations(statusFilter)) || []);
    } catch {
      toast.error(t('errors.conversations'));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const wanted = statusFilter;
    void (async () => {
      try {
        const rows = await fetchConversations(wanted);
        if (!cancelled) setConversations(rows || []);
      } catch {
        if (!cancelled) toast.error(t('errors.conversations'));
      } finally {
        if (!cancelled) setLoadedStatus(wanted);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedUserId) return;
    const reqId = ++chatReqRef.current;
    const wanted = selectedUserId;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchThread(wanted);
        if (cancelled || chatReqRef.current !== reqId) return;
        setDetail(res);
        setConversations((prev) => prev.map((row) => (row.user_id === wanted ? { ...row, unread_count: 0 } : row)));
      } catch {
        if (cancelled || chatReqRef.current !== reqId) return;
        toast.error(t('errors.messages'));
      } finally {
        if (!cancelled && chatReqRef.current === reqId) setLoadedUserId(wanted);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Keyed on the thread as well as the count, so two threads of equal
  // length do not open at each other's scroll offset.
  useEffect(() => {
    if (activeDetail?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeDetail?.id, activeDetail?.messages?.length]);

  // Thread poll — by id, never by count, against the ref, never the closure.
  useEffect(() => {
    if (!selectedUserId) return;
    const intervalId = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetchThread(selectedUserId);
        if (!res) return;
        if (res.user_id !== selectedRef.current) return;
        setDetail((prev) => {
          if (!prev) return res;
          if (res.user_id !== prev.user_id) return res;
          const known = new Set(prev.messages.map((m) => m.id));
          const arrived = res.messages.filter((m) => !known.has(m.id));
          if (arrived.length > 0) {
            if (arrived.some((m) => m.sender_type === 'USER')) playSupportNotificationSound();
            const server = new Set(res.messages.map((m) => m.id));
            const pending = prev.messages.filter((m) => !server.has(m.id));
            return { ...res, messages: [...res.messages, ...pending] };
          }
          if (res.status !== prev.status) return { ...prev, status: res.status };
          return prev;
        });
      } catch {
        // Silently ignore background polling errors
      }
    }, 2500);
    return () => clearInterval(intervalId);
  }, [selectedUserId]);

  // List poll.
  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await http.get<AdminSupportConversation[]>(
          api.support.conversations({ status: statusFilter === 'ALL' ? undefined : statusFilter }),
        );
        if (res) setConversations(res);
      } catch {
        // Silently ignore background polling errors
      }
    }, 4000);
    return () => clearInterval(intervalId);
  }, [statusFilter]);

  const handleSendReply = async () => {
    const target = selectedUserId;
    if (!replyText.trim() || !target || sending) return;
    setSending(true);
    try {
      const res = await http.post<AdminSupportMessage>(api.support.sendReply(target), { text: replyText.trim() });
      setReplyText('');
      setDetail((prev) => {
        if (!prev || prev.user_id !== target) return prev;
        if (prev.messages.some((m) => m.id === res.id)) return prev;
        return { ...prev, messages: [...prev.messages, res] };
      });
      setConversations((prev) =>
        prev.map((row) =>
          row.user_id === target
            ? { ...row, last_message: res.text, last_message_at: res.created_at, last_message_sender: 'ADMIN' }
            : row,
        ),
      );
      toast.success(t('replySent'));
    } catch {
      toast.error(t('errors.send'));
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUserId || !activeDetail || activeDetail.user_id !== selectedUserId) return;
    const target = selectedUserId;
    const nextStatus = activeDetail.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    try {
      await http.patch(api.support.updateStatus(target), { status: nextStatus });
      setDetail((prev) => (prev && prev.user_id === target ? { ...prev, status: nextStatus } : prev));
      setConversations((prev) => prev.map((row) => (row.user_id === target ? { ...row, status: nextStatus } : row)));
      toast.success(t('statusChanged'));
    } catch {
      toast.error(t('errors.status'));
    }
  };

  const filteredConversations = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return conversations;
    return conversations.filter(
      (conv) =>
        conv.user?.name?.toLowerCase().includes(query) ||
        conv.user?.phone?.toLowerCase().includes(query) ||
        conv.last_message?.toLowerCase().includes(query),
    );
  }, [conversations, searchQuery]);

  const customerName = (user: AdminSupportUser | null | undefined) => user?.name?.trim() || t('customer');

  return (
    <div className="conv-wrap">
      {/* ══════ LEFT — customers ══════ */}
      <div className={cn('conv-list-panel', selectedUserId && 'hidden-mobile')}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap' }}>
                {t('listTitle')}
              </h2>
              {loadedStatus && <CountChip value={conversations.length} />}
            </div>
            <button
              type="button"
              onClick={() => void reloadConversations()}
              disabled={loadingList}
              className="btn-circle-action"
              title={t('refresh')}
              aria-label={t('refresh')}
            >
              <RefreshCw size={13} className={cn(loadingList && 'animate-spin')} />
            </button>
          </div>

          <ListSearch value={searchQuery} onChange={setSearchQuery} placeholder={t('search')} />

          <GlassTabs<StatusFilter>
            tabs={[
              { key: 'ALL', label: t('all') },
              { key: 'OPEN', label: t('open') },
              { key: 'RESOLVED', label: t('resolved') },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Global AI auto-reply switch — the one control that changes what
              every customer hears while nobody is at this desk. */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 12,
              background: aiEnabled ? 'rgba(16,185,129,0.08)' : 'var(--color-surface-2)',
              border: `1px solid ${aiEnabled ? 'var(--color-success-border)' : 'var(--color-border)'}`,
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: aiEnabled ? 'rgba(16,185,129,0.15)' : 'var(--color-surface-3)',
                color: aiEnabled ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
            >
              <Bot size={15} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{t('aiAssistant')}</span>
                <span
                  className={cn(aiEnabled && 'animate-pulse')}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: aiEnabled ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'inline-block' }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {aiEnabled ? t('aiEnabledDesc') : t('aiDisabledDesc')}
              </p>
            </div>
            <IOSToggle checked={aiEnabled} onChange={(next) => void handleToggleAi(next)} disabled={togglingAi} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loadingList && conversations.length === 0 ? (
            <ListLoading label={c('loading')} />
          ) : filteredConversations.length === 0 ? (
            <ListEmpty title={t('noConversations')} hint={searchQuery ? t('tryDifferentSearch') : undefined} />
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedUserId === conv.user_id;
              const unread = conv.unread_count > 0;
              const name = customerName(conv.user);
              return (
                <button key={conv.id} type="button" onClick={() => setSelectedUserId(conv.user_id)} className={cn('conv-list-item', isSelected && 'active')}>
                  <DeskAvatar name={name} src={conv.user?.avatar} dot={conv.status === 'OPEN' ? 'success' : 'muted'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
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
                        {name}
                      </p>
                      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', flexShrink: 0 }}>{formatClock(conv.last_message_at, locale)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.user?.phone || '—'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
                      <p
                        style={{
                          fontSize: 12.5,
                          margin: 0,
                          color: unread ? '#2b86c5' : 'var(--color-text-muted)',
                          fontWeight: unread ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'left',
                          flex: 1,
                        }}
                      >
                        {conv.last_message_sender === 'ADMIN' && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{t('senderYou')}: </span>}
                        {conv.last_message || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>…</span>}
                      </p>
                      {unread && <UnreadBadge count={conv.unread_count} />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══════ RIGHT — thread ══════ */}
      <div className={cn('conv-chat-panel', !selectedUserId && 'hidden-mobile')}>
        {!selectedUserId ? (
          <ThreadEmpty icon={<Headphones size={36} strokeWidth={1.8} />} title={t('title')} hint={t('selectConversation')} />
        ) : (
          <>
            <div className="conv-chat-header">
              <button type="button" onClick={() => setSelectedUserId(null)} className="md:hidden btn-circle-action mobile-back" aria-label={t('back')}>
                <ArrowLeft size={16} />
              </button>

              {activeDetail ? (
                <>
                  <DeskAvatar name={customerName(activeDetail.user)} src={activeDetail.user?.avatar} size={40} dot={activeDetail.status === 'OPEN' ? 'success' : 'muted'} />
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
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
                      }}
                    >
                      {customerName(activeDetail.user)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <HeaderStatus tone={activeDetail.status === 'OPEN' ? 'success' : 'muted'}>
                        {activeDetail.status === 'OPEN' ? t('statusOpen') : t('statusResolved')}
                      </HeaderStatus>
                      {activeDetail.user?.phone && (
                        <a
                          href={`tel:${activeDetail.user.phone}`}
                          className="hidden sm:inline-flex"
                          style={{ alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'none' }}
                        >
                          <Phone size={11} />
                          {activeDetail.user.phone}
                        </a>
                      )}
                      {activeDetail.user?.role && (
                        <span className="hidden md:inline-flex" style={{ alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                          <Shield size={11} />
                          {activeDetail.user.role}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {activeDetail.user?.phone && (
                      <a href={`tel:${activeDetail.user.phone}`} className="sm:hidden btn-circle-action" aria-label={t('userPhone')}>
                        <Phone size={13} />
                      </a>
                    )}
                    {activeDetail.status === 'OPEN' ? (
                      <button type="button" onClick={() => void handleToggleStatus()} className="btn-pause-ai active-glow" title={t('markResolved')}>
                        <span className="btn-pause-ai-inner">
                          <CheckCircle2 size={13} />
                          <span className="btn-pause-ai-text">{t('markResolved')}</span>
                        </span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => void handleToggleStatus()} className="btn-pause-ai warning-static" title={t('markOpen')}>
                        <RotateCcw size={13} />
                        <span className="btn-pause-ai-text">{t('markOpen')}</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Spinner size="sm" label={c('loading')} />
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c('loading')}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col" style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ChatBg />

              <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1, padding: '16px 12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {loadingChat || !activeDetail ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                    <Spinner size="lg" label={c('loading')} />
                  </div>
                ) : (
                  activeDetail.messages.map((msg) => {
                    const isAdmin = msg.sender_type === 'ADMIN';
                    const operatorLabel = !isAdmin
                      ? null
                      : msg.sender_id === myAdminId
                        ? t('senderOperator')
                        : msg.sender_name
                          ? t('senderColleague', { name: msg.sender_name })
                          : t('senderSystem');
                    return (
                      <MessageBubble
                        key={msg.id}
                        side={isAdmin ? 'operator' : 'user'}
                        label={operatorLabel}
                        avatar={activeDetail.user?.avatar ? <DeskAvatar name={customerName(activeDetail.user)} src={activeDetail.user.avatar} size={28} /> : undefined}
                        time={formatClock(msg.created_at, locale)}
                      >
                        {msg.text}
                      </MessageBubble>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <Composer
                value={replyText}
                onChange={setReplyText}
                onSend={() => void handleSendReply()}
                placeholder={t('replyPlaceholder')}
                sending={sending}
                sendLabel={t('sendReply')}
                above={
                  <div className="scrollbar-hide" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                    {QUICK_REPLY_KEYS.map((key) => {
                      const text = t(key);
                      return (
                        <button key={key} type="button" className="conv-quick-chip" onClick={() => setReplyText((prev) => (prev ? `${prev} ${text}` : text))}>
                          {text}
                        </button>
                      );
                    })}
                  </div>
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SupportDesk;
