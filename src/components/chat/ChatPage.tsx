import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  Info,
  MessageSquare,
  PlusCircle,
  Send,
  Loader2,
  Headphones,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';
import { canPublishListings } from '../../types/roles';
import {
  chatApi,
  Conversation,
  ConversationDetail,
  SupportConversationDetail,
  SupportMessage,
} from '../../services/chatApi';
import { cn } from '../../lib/cn';

const QUICK_QUESTION_KEYS = [
  'chat.composer.quick.viewing',
  'chat.composer.quick.address',
  'chat.composer.quick.contract',
  'chat.composer.quick.phone',
] as const;

const SUPPORT_QUICK_KEYS = [
  'chat.support.quickListing',
  'chat.support.quickPayment',
  'chat.support.quickAccount',
  'chat.support.quickOther',
] as const;

const playNotificationSound = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    // Close the context after the sound finishes to free resources.
    osc.onended = () => { void ctx.close(); };
  } catch {
    // Ignore audio errors
  }
};

export const ChatPage: React.FC = () => {
  const { t, formatPrice, formatRelativeTime } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const pushToast = useAppStore((state) => state.pushToast);
  const activeConversationId = useAppStore((state) => state.activeConversationId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [supportConv, setSupportConv] = useState<SupportConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list or active thread
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    
    if (!activeConversationId) {
      setLoading(true);
      Promise.all([
        chatApi.listConversations().catch(() => []),
        chatApi.getSupportConversation().catch(() => null),
      ])
        .then(([convs, supp]) => {
          if (!isMounted) return;
          setConversations(convs);
          if (supp) setSupportConv(supp);
        })
        .catch(() => {
          if (isMounted) pushToast('common.error.generic', 'error');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (activeConversationId === 'support') {
      setLoading(true);
      chatApi.getSupportConversation()
        .then(data => {
          if (isMounted) setSupportConv(data);
        })
        .catch(() => {
          if (isMounted) pushToast('common.error.generic', 'error');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(true);
      chatApi.getMessages(activeConversationId)
        .then(data => {
          if (isMounted) setDetail(data);
        })
        .catch(() => {
          if (isMounted) pushToast('common.error.generic', 'error');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    
    return () => { isMounted = false; };
  }, [activeConversationId, currentUser, pushToast]);

  // Scroll to bottom when messages load or change
  useEffect(() => {
    if (detail || (activeConversationId === 'support' && supportConv)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [detail?.messages.length, supportConv?.messages.length, activeConversationId]);

  // Real-time automatic background polling (new messages appear automatically without page refresh)
  useEffect(() => {
    if (!currentUser) return;

    const intervalId = setInterval(async () => {
      try {
        if (activeConversationId === 'support') {
          const freshSupport = await chatApi.getSupportConversation();
          if (!freshSupport) return;
          setSupportConv((prev) => {
            if (!prev) return freshSupport;
            if (freshSupport.messages.length > prev.messages.length) {
              const lastFresh = freshSupport.messages[freshSupport.messages.length - 1];
              if (lastFresh.sender_type === 'ADMIN') {
                playNotificationSound();
              }
              return freshSupport;
            }
            return prev;
          });
        } else if (activeConversationId) {
          const freshDetail = await chatApi.getMessages(activeConversationId);
          if (!freshDetail) return;
          setDetail((prev) => {
            if (!prev) return freshDetail;
            if (freshDetail.messages.length > prev.messages.length) {
              const lastFresh = freshDetail.messages[freshDetail.messages.length - 1];
              if (lastFresh.sender_id !== currentUser.id) {
                playNotificationSound();
              }
              return freshDetail;
            }
            return prev;
          });
        } else {
          const [convs, supp] = await Promise.all([
            chatApi.listConversations().catch(() => null),
            chatApi.getSupportConversation().catch(() => null),
          ]);
          if (convs) setConversations(convs);
          if (supp) setSupportConv(supp);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [activeConversationId, currentUser]);

  const handleCreateListing = () => {
    if (!currentUser) {
      setShowAuth(true, 'REGISTER');
      return;
    }
    if (!canPublishListings(currentUser.role)) {
      pushToast('chat.toast.ownerOnly', 'warning');
      return;
    }
    setCurrentView('CREATE_LISTING');
  };

  const handleSend = async () => {
    if (!draft.trim() || !activeConversationId || sending) return;
    setSending(true);
    try {
      if (activeConversationId === 'support') {
        const newMsg = await chatApi.sendSupportMessage(draft.trim());
        setDraft('');
        playNotificationSound();
        setSupportConv(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMsg],
          last_message: newMsg.text,
          last_message_at: newMsg.created_at,
        } : prev);
      } else {
        const newMsg = await chatApi.sendMessage(activeConversationId, draft.trim());
        setDraft('');
        playNotificationSound();
        setDetail(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
      }
    } catch {
      pushToast('common.error.generic', 'error');
    } finally {
      setSending(false);
    }
  };

  const appendQuestion = (text: string) => {
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n${text}` : text));
  };

  if (!currentUser) {
    return null; // Handled by App.tsx guarded views
  }

  // LIST VIEW
  if (!activeConversationId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <header className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-content sm:text-2xl">{t('layout.nav.chat')}</h1>
            <p className="mt-0.5 text-sm text-muted">{t('chat.page.subtitle')}</p>
          </div>
        </header>

        {loading ? (
          <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* PINNED CUSTOMER SUPPORT CARD */}
            <button
              type="button"
              onClick={() => setCurrentView('CHAT', null, 'support')}
              className={cn(
                "group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
                "border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-surface hover:border-blue-400 hover:shadow-md",
                "dark:border-blue-900/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-surface dark:hover:border-blue-700",
                (supportConv?.unread_count ?? 0) > 0 && "ring-2 ring-blue-500/40"
              )}
            >
              <span className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/25 transition-transform duration-200 group-hover:scale-105">
                  <Headphones className="h-6 w-6 stroke-[2.2]" />
                </div>
                {/* Online pulse dot */}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" />
                </span>
                {(supportConv?.unread_count ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white shadow">
                    {supportConv!.unread_count}
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-content group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {t('chat.support.title')}
                    </p>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 shrink-0">
                      <ShieldCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      {t('chat.support.role')}
                    </span>
                  </div>
                  {supportConv?.last_message_at ? (
                    <time
                      dateTime={supportConv.last_message_at}
                      className="shrink-0 text-[10px] text-subtle"
                    >
                      {formatRelativeTime(supportConv.last_message_at)}
                    </time>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      {t('chat.support.pinned')}
                    </span>
                  )}
                </div>

                <p className="text-[11px] font-medium text-blue-600/90 dark:text-blue-400">
                  {t('chat.support.operator')}
                </p>

                <p
                  className={cn(
                    "mt-1.5 truncate text-xs",
                    (supportConv?.unread_count ?? 0) > 0
                      ? "font-semibold text-content"
                      : "text-muted"
                  )}
                >
                  {supportConv?.last_message_sender === 'USER' && (
                    <span className="text-subtle">{t('chat.list.youPrefix')} </span>
                  )}
                  {supportConv?.last_message || t('chat.support.welcome')}
                </p>
              </div>
            </button>

            {/* Regular conversation threads */}
            {conversations.map(conv => {
              const isOwner = conv.owner_id === currentUser.id;
              const otherPerson = isOwner ? conv.user : conv.owner;
              const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(otherPerson?.name || 'U')}&background=random`;
              const unread = conv.unread_count ?? 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => setCurrentView('CHAT', null, conv.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border bg-surface p-4 text-left shadow-sm transition-colors hover:border-brand/50 ${
                    unread > 0 ? 'border-brand/40 bg-brand-soft/30' : 'border-line'
                  }`}
                >
                  <span className="relative shrink-0">
                    <img
                      src={otherPerson?.avatar || avatarFallback}
                      alt=""
                      className="h-12 w-12 rounded-full border border-line bg-surface-2 object-cover"
                    />
                    {unread > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                        {unread}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-content">
                        {otherPerson?.name || t('chat.list.unknownPerson')}
                      </p>
                      {conv.last_message_at && (
                        <time
                          dateTime={conv.last_message_at}
                          className="shrink-0 text-[10px] text-subtle"
                        >
                          {formatRelativeTime(conv.last_message_at)}
                        </time>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold text-muted">
                      {isOwner ? t('chat.list.roleTenant') : t('chat.list.roleOwner')}
                    </p>

                    {conv.listing && (
                      <span className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-content">
                        <Building2 className="h-3 w-3 shrink-0 text-brand" aria-hidden="true" />
                        <span className="truncate font-semibold">{conv.listing.title}</span>
                        {conv.listing.price != null && (
                          <span className="shrink-0 text-muted">
                            · {formatPrice(conv.listing.price, (conv.listing.currency as any) || 'UZS')}
                          </span>
                        )}
                      </span>
                    )}

                    {conv.last_message && (
                      <p
                        className={`mt-1.5 truncate text-xs ${
                          unread > 0 ? 'font-semibold text-content' : 'text-muted'
                        }`}
                      >
                        {conv.last_message_is_mine && (
                          <span className="text-subtle">{t('chat.list.youPrefix')} </span>
                        )}
                        {conv.last_message}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}

            {conversations.length === 0 && (
              <section role="status" className="mt-5 rounded-2xl border border-info/30 bg-info-soft p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-sm font-black text-info">
                  <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t('chat.notice.title')}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-content">{t('chat.notice.body')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setCurrentView('LISTINGS')} className="px-4 py-2.5 text-xs">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    {t('chat.actions.browse')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCreateListing} className="px-4 py-2.5 text-xs">
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    {t('chat.actions.create')}
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  // SUPPORT CHAT DETAIL VIEW
  if (activeConversationId === 'support') {
    const getAvatarFallback = (name?: string | null) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`;

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto px-4 py-4">
        <header className="flex items-center gap-3 pb-4 border-b border-line shrink-0">
          <button 
            onClick={() => setCurrentView('CHAT', null, null)}
            className="p-2 -ml-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-sm">
                <Headphones className="h-5 w-5 stroke-[2.2]" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-base font-black text-content">
                  {t('chat.support.title')}
                </h1>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  <ShieldCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  {t('chat.support.role')}
                </span>
              </div>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                ● {t('chat.support.operator')}
              </p>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Welcome Banner Card */}
          <div className="rounded-2xl border border-blue-200/60 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 p-4 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-indigo-950/10">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-xs leading-relaxed text-content">
                <p className="font-bold text-blue-700 dark:text-blue-300">
                  {t('chat.support.title')}
                </p>
                <p className="mt-0.5 text-muted">
                  {t('chat.support.welcome')}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
          ) : (
            supportConv?.messages.map((msg) => {
              const isMe = msg.sender_type === 'USER' || (msg.sender_id && String(msg.sender_id).toLowerCase() === String(currentUser?.id).toLowerCase());

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex w-full items-end gap-2',
                    isMe ? 'justify-end' : 'justify-start',
                  )}
                >
                  {!isMe && (
                    <div className="shrink-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                        <Headphones className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm text-sm',
                      isMe
                        ? 'rounded-br-xs bg-brand text-on-brand shadow-brand/20'
                        : 'rounded-bl-xs border border-blue-200/70 bg-surface text-content dark:border-blue-900/50',
                    )}
                  >
                    {!isMe && (
                      <p className="mb-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        {t('chat.support.title')}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px] font-medium',
                        isMe ? 'text-right text-on-brand/80' : 'text-left text-muted',
                      )}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {isMe && (
                    <div className="shrink-0">
                      <img
                        src={currentUser?.avatar || getAvatarFallback(currentUser?.name)}
                        alt="avatar"
                        className="h-7 w-7 rounded-full border border-line bg-surface-2 object-cover"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="pt-4 shrink-0 border-t border-line">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {SUPPORT_QUICK_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendQuestion(t(key))}
                className="shrink-0 rounded-full border border-blue-200/80 bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-blue-900/50 dark:hover:border-blue-500 dark:hover:text-blue-400"
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 mt-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={t('chat.composer.placeholder')}
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors focus:border-brand focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  const isOwner = detail?.owner_id === currentUser.id;
  const otherPerson = isOwner ? detail?.user : detail?.owner;
  const mePerson = isOwner ? detail?.owner : detail?.user;
  
  const getAvatarFallback = (name?: string | null) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`;
  
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto px-4 py-4">
      <header className="flex items-center gap-3 pb-4 border-b border-line shrink-0">
        <button 
          onClick={() => setCurrentView('CHAT', null, null)}
          className="p-2 -ml-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={otherPerson?.avatar || getAvatarFallback(otherPerson?.name)}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-content">
              {otherPerson?.name || t('layout.nav.chat')}
            </h1>
            {/* The subject of the thread, and a way into it. Without this the
                conversation is a name with no context on either side. */}
            {detail?.listing && (
              <button
                type="button"
                onClick={() => setCurrentView('LISTING_DETAIL', detail.listing!.id)}
                className="flex min-w-0 items-center gap-1 text-[11px] text-muted transition-colors hover:text-brand-text"
              >
                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate font-semibold">{detail.listing.title}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
        ) : (
          detail?.messages.map((msg) => {
            const isMe = Boolean(
              (currentUser?.id && msg.sender_id && String(msg.sender_id).toLowerCase() === String(currentUser.id).toLowerCase()) ||
              (currentUser?.id && (msg as any).senderId && String((msg as any).senderId).toLowerCase() === String(currentUser.id).toLowerCase()) ||
              (msg as any).is_me ||
              (msg as any).isMe
            );
            const msgSender = isMe ? (mePerson?.name ? mePerson : currentUser) : otherPerson;

            return (
              <div
                key={msg.id}
                className={cn(
                  'flex w-full items-end gap-2',
                  isMe ? 'justify-end' : 'justify-start',
                )}
              >
                {!isMe && (
                  <div className="shrink-0">
                    <img
                      src={msgSender?.avatar || getAvatarFallback(msgSender?.name)}
                      alt="avatar"
                      className="h-7 w-7 rounded-full border border-line bg-surface-2 object-cover"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm text-sm',
                    isMe
                      ? 'rounded-br-xs bg-brand text-on-brand shadow-brand/20'
                      : 'rounded-bl-xs border border-line bg-surface text-content shadow-sm',
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px] font-medium',
                      isMe ? 'text-right text-on-brand/80' : 'text-left text-muted',
                    )}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {isMe && (
                  <div className="shrink-0">
                    <img
                      src={currentUser?.avatar || getAvatarFallback(currentUser?.name)}
                      alt="avatar"
                      className="h-7 w-7 rounded-full border border-line bg-surface-2 object-cover"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="pt-4 shrink-0 border-t border-line">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {QUICK_QUESTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => appendQuestion(t(key))}
              className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
            >
              {t(key)}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={t('chat.composer.placeholder')}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm transition-colors focus:border-brand focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
