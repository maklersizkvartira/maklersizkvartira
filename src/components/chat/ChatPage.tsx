import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sparkles,
  Pencil,
  Trash2,
  X,
  Check
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';
import { canPublishListings } from '../../types/roles';
import {
  chatApi,
  ChatMessage,
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
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  // Message Editing & Swipe Actions state
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [swipedMessageId, setSwipedMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Touch swipe handling refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const activeTouchMsgIdRef = useRef<string | null>(null);

  // Load conversations list or active thread
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;

    if (!activeConversationId) {
      setLoading(true);
      Promise.all([
        chatApi.listConversations().catch(() => []),
        chatApi.getSupportConversation().catch(() => null),
      ]).then(([list, support]) => {
        if (!isMounted) return;
        setConversations(list);
        setSupportConv(support);
      }).finally(() => {
        if (isMounted) setLoading(false);
      });
    } else if (activeConversationId === 'support') {
      setLoading(true);
      chatApi.getSupportConversation()
        .then((data) => {
          if (!isMounted) return;
          setSupportConv(data);
        })
        .catch(() => {
          if (!isMounted) return;
          pushToast('common.error.generic', 'error');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(true);
      chatApi.getMessages(activeConversationId)
        .then((data) => {
          if (!isMounted) return;
          setDetail(data);
        })
        .catch(() => {
          if (!isMounted) return;
          pushToast('common.error.generic', 'error');
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [activeConversationId, currentUser, pushToast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (detail || (activeConversationId === 'support' && supportConv)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [detail?.messages.length, supportConv?.messages.length, activeConversationId]);

  // Periodic polling for active conversation
  useEffect(() => {
    if (!activeConversationId || !currentUser) return;

    const interval = setInterval(async () => {
      try {
        if (activeConversationId === 'support') {
          const freshSupport = await chatApi.getSupportConversation();
          setSupportConv((prev) => {
            if (!prev) return freshSupport;
            if (freshSupport.messages.length > prev.messages.length) {
              const lastMsg = freshSupport.messages[freshSupport.messages.length - 1];
              if (lastMsg.sender_type === 'ADMIN') {
                playNotificationSound();
              }
            }
            return freshSupport;
          });
        } else if (activeConversationId) {
          const freshDetail = await chatApi.getMessages(activeConversationId);
          setDetail((prev) => {
            if (!prev) return freshDetail;
            if (freshDetail.messages.length > prev.messages.length) {
              const lastMsg = freshDetail.messages[freshDetail.messages.length - 1];
              if (String(lastMsg.sender_id).toLowerCase() !== String(currentUser.id).toLowerCase()) {
                playNotificationSound();
              }
            }
            return freshDetail;
          });
        }
      } catch {
        // Background polling errors are silent
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeConversationId, currentUser]);

  // Close swipe actions when clicking elsewhere
  useEffect(() => {
    const handleDocumentClick = () => {
      setSwipedMessageId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleCreateListing = () => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }
    if (!canPublishListings(currentUser.role)) {
      pushToast('owner.guard.roleRequired', 'error');
      return;
    }
    setCurrentView('CREATE_LISTING');
  };

  // SEND or EDIT MESSAGE
  const handleSend = async () => {
    if (!draft.trim() || !activeConversationId || sending) return;

    setSending(true);
    try {
      if (editingMessage) {
        // Edit existing message
        const updatedMsg = await chatApi.editMessage(editingMessage.id, draft.trim());
        setDetail((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
          };
        });
        setEditingMessage(null);
        setDraft('');
        pushToast('Xabar tahrirlandi', 'success');
      } else if (activeConversationId === 'support') {
        const newMsg = await chatApi.sendSupportMessage(draft.trim());
        setDraft('');
        playNotificationSound();
        setSupportConv((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, newMsg],
                last_message: newMsg.text,
                last_message_at: newMsg.created_at,
              }
            : prev
        );
      } else {
        const newMsg = await chatApi.sendMessage(activeConversationId, draft.trim());
        setDraft('');
        playNotificationSound();
        setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev));
      }
    } catch {
      pushToast('common.error.generic', 'error');
    } finally {
      setSending(false);
    }
  };

  // Start editing a message
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage({ id: msg.id, text: msg.text });
    setDraft(msg.text);
    setSwipedMessageId(null);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setDraft('');
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    setDeletingMessageId(messageId);
    try {
      await chatApi.deleteMessage(messageId);
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== messageId),
        };
      });
      setSwipedMessageId(null);
      if (editingMessage?.id === messageId) {
        handleCancelEdit();
      }
      pushToast('Xabar o‘chirildi', 'info');
    } catch {
      pushToast('common.error.generic', 'error');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Delete entire conversation
  const handleDeleteConversation = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (!window.confirm('Haqiqatan ham ushbu yozishmani o‘chirmoqchimisiz?')) return;

    setDeletingConvId(conversationId);
    try {
      await chatApi.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      pushToast('Yozishma o‘chirildi', 'info');
    } catch {
      pushToast('common.error.generic', 'error');
    } finally {
      setDeletingConvId(null);
    }
  };

  // Touch Swipe Handlers for mobile gestures
  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    activeTouchMsgIdRef.current = msgId;
  };

  const handleTouchEnd = (e: React.TouchEvent, msgId: string, isMe: boolean) => {
    if (activeTouchMsgIdRef.current !== msgId) return;
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current;

    // Only recognize horizontal swipe if horizontal movement is dominant
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (isMe) {
        // Tapping or swiping left/right shows action buttons
        setSwipedMessageId((prev) => (prev === msgId ? null : msgId));
      }
    }
  };

  const appendQuestion = (text: string) => {
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n${text}` : text));
    textareaRef.current?.focus();
  };

  if (!currentUser) {
    return null;
  }

  // =========================================================================
  // VIEW 1: CONVERSATIONS LIST
  // =========================================================================
  if (!activeConversationId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8 pb-28">
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
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* PINNED CUSTOMER SUPPORT CARD */}
            <button
              type="button"
              onClick={() => setCurrentView('CHAT', null, 'support')}
              className={cn(
                'group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200',
                'border-blue-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-surface hover:border-blue-400 hover:shadow-md',
                'dark:border-blue-900/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-surface dark:hover:border-blue-700',
                (supportConv?.unread_count ?? 0) > 0 && 'ring-2 ring-blue-500/40'
              )}
            >
              <span className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/25 transition-transform duration-200 group-hover:scale-105">
                  <Headphones className="h-6 w-6 stroke-[2.2]" />
                </div>
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
                    <time dateTime={supportConv.last_message_at} className="shrink-0 text-[10px] text-subtle">
                      {formatRelativeTime(supportConv.last_message_at)}
                    </time>
                  ) : (
                    <span className="shrink-0 inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      {t('chat.support.pinned')}
                    </span>
                  )}
                </div>

                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {supportConv?.last_message || t('chat.support.welcome')}
                </p>
              </div>
            </button>

            {/* DIRECT USER LISTING CONVERSATIONS */}
            {conversations.map((conv) => {
              const isOwner = conv.owner_id === currentUser.id;
              const other = isOwner ? conv.user : conv.owner;
              const unread = conv.unread_count ?? 0;
              const isDeleting = deletingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  className="group relative flex items-center justify-between rounded-2xl border border-line bg-surface hover:border-line-2 transition-all shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setCurrentView('CHAT', null, conv.id)}
                    className="flex w-full items-start gap-3 p-4 text-left min-w-0"
                  >
                    <span className="relative shrink-0">
                      <img
                        src={other?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.name || 'U')}&background=random`}
                        alt=""
                        className="h-12 w-12 rounded-2xl border border-line object-cover"
                      />
                      {unread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
                          {unread}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate text-sm', unread > 0 ? 'font-black text-content' : 'font-semibold text-content')}>
                          {other?.name || t('layout.nav.chat')}
                        </p>
                        {conv.last_message_at && (
                          <time dateTime={conv.last_message_at} className="shrink-0 text-[10px] text-subtle">
                            {formatRelativeTime(conv.last_message_at)}
                          </time>
                        )}
                      </div>

                      {conv.listing && (
                        <span className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] text-content max-w-fit">
                          <Building2 className="h-3 w-3 shrink-0 text-brand" aria-hidden="true" />
                          <span className="truncate font-semibold max-w-[200px]">{conv.listing.title}</span>
                          {conv.listing.price != null && (
                            <span className="shrink-0 text-muted">
                              · {formatPrice(conv.listing.price, (conv.listing.currency as any) || 'UZS')}
                            </span>
                          )}
                        </span>
                      )}

                      {conv.last_message && (
                        <p className={`mt-1.5 truncate text-xs ${unread > 0 ? 'font-semibold text-content' : 'text-muted'}`}>
                          {conv.last_message_is_mine && <span className="text-subtle">{t('chat.list.youPrefix')} </span>}
                          {conv.last_message}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Delete conversation button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    disabled={isDeleting}
                    title="Yozishmani o‘chirish"
                    className="p-3 mr-2 text-subtle hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition opacity-60 group-hover:opacity-100"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
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

  // =========================================================================
  // VIEW 2: SUPPORT CHAT DETAIL
  // =========================================================================
  if (activeConversationId === 'support') {
    return (
      <div className="flex flex-col h-[calc(100dvh-72px)] sm:h-[calc(100dvh-84px)] max-w-3xl mx-auto px-3 sm:px-4">
        <header className="flex items-center gap-3 py-3 border-b border-line shrink-0 bg-surface">
          <button
            onClick={() => setCurrentView('CHAT', null, null)}
            className="p-2 -ml-2 rounded-xl hover:bg-surface-2 text-muted transition-colors"
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
                <h1 className="truncate text-base font-black text-content">{t('chat.support.title')}</h1>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                  <ShieldCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  {t('chat.support.role')}
                </span>
              </div>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">● {t('chat.support.operator')}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          ) : (
            supportConv?.messages.map((msg) => {
              const isMe = msg.sender_type === 'USER' || (msg.sender_id && String(msg.sender_id).toLowerCase() === String(currentUser?.id).toLowerCase());

              return (
                <div key={msg.id} className={cn('flex w-full items-end gap-2', isMe ? 'justify-end' : 'justify-start')}>
                  {!isMe && (
                    <div className="shrink-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                        <Headphones className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[82%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm text-sm',
                      isMe
                        ? 'rounded-br-xs bg-brand text-on-brand shadow-brand/20'
                        : 'rounded-bl-xs border border-blue-200/70 bg-surface text-content dark:border-blue-900/50'
                    )}
                  >
                    {!isMe && <p className="mb-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">{t('chat.support.title')}</p>}
                    <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.text}</p>
                    <p className={cn('mt-1 text-[10px] font-medium', isMe ? 'text-right text-on-brand/80' : 'text-left text-muted')}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* COMPOSER FOR SUPPORT */}
        <div className="shrink-0 border-t border-line bg-surface pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {SUPPORT_QUICK_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendQuestion(t(key))}
                className="shrink-0 rounded-full border border-blue-200/80 bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-blue-900/50"
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 mt-1">
            <textarea
              ref={textareaRef}
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
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm focus:border-brand focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-on-brand disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ACTIVE CONVERSATION DETAIL (With Swipe, Edit, Delete & Raised Mobile Composer)
  // =========================================================================
  const isOwner = detail?.owner_id === currentUser.id;
  const otherPerson = isOwner ? detail?.user : detail?.owner;
  const mePerson = isOwner ? detail?.owner : detail?.user;

  const getAvatarFallback = (name?: string | null) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=random`;

  return (
    <div className="flex flex-col h-[calc(100dvh-72px)] sm:h-[calc(100dvh-84px)] max-w-3xl mx-auto px-3 sm:px-4">
      {/* HEADER */}
      <header className="flex items-center gap-3 py-3 border-b border-line shrink-0 bg-surface">
        <button
          onClick={() => {
            handleCancelEdit();
            setCurrentView('CHAT', null, null);
          }}
          className="p-2 -ml-2 rounded-xl hover:bg-surface-2 text-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={otherPerson?.avatar || getAvatarFallback(otherPerson?.name)}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-line object-cover"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-content">{otherPerson?.name || t('layout.nav.chat')}</h1>
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

      {/* MESSAGES CONTAINER */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          detail?.messages.map((msg) => {
            const isMe = Boolean(
              (currentUser?.id && msg.sender_id && String(msg.sender_id).toLowerCase() === String(currentUser.id).toLowerCase()) ||
              (currentUser?.id && (msg as any).senderId && String((msg as any).senderId).toLowerCase() === String(currentUser.id).toLowerCase()) ||
              (msg as any).is_me ||
              (msg as any).isMe
            );
            const msgSender = isMe ? (mePerson?.name ? mePerson : currentUser) : otherPerson;
            const isSwiped = swipedMessageId === msg.id;
            const isBeingDeleted = deletingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={cn('relative flex w-full items-end gap-2 group', isMe ? 'justify-end' : 'justify-start')}
                onTouchStart={(e) => handleTouchStart(e, msg.id)}
                onTouchEnd={(e) => handleTouchEnd(e, msg.id, isMe)}
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

                {/* ACTION BUTTONS (Edit & Delete) - Appears on Swipe or on Desktop Hover */}
                {isMe && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'flex items-center gap-1 transition-all duration-200',
                      isSwiped
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      title="Xabarni tahrirlash"
                      className="p-1.5 rounded-full bg-surface-2 border border-line text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition shadow-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(msg.id)}
                      disabled={isBeingDeleted}
                      title="Xabarni o‘chirish"
                      className="p-1.5 rounded-full bg-surface-2 border border-line text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition shadow-xs"
                    >
                      {isBeingDeleted ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {/* MESSAGE BUBBLE */}
                <div
                  className={cn(
                    'max-w-[80%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm text-sm transition-transform duration-200 select-text',
                    isMe
                      ? 'rounded-br-xs bg-brand text-on-brand shadow-brand/20'
                      : 'rounded-bl-xs border border-line bg-surface text-content',
                    isSwiped && isMe && '-translate-x-1'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.text}</p>
                  <div
                    className={cn(
                      'mt-1 flex items-center gap-1.5 text-[10px] font-medium',
                      isMe ? 'justify-end text-on-brand/80' : 'justify-start text-muted'
                    )}
                  >
                    {(msg as any).updated_at && (msg as any).updated_at !== msg.created_at && (
                      <span className="italic opacity-80 text-[9px]">(tahrirlangan)</span>
                    )}
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
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

      {/* COMPOSER (Input Bar - Raised for Mobile & Keyboard Visibility) */}
      <div className="shrink-0 border-t border-line bg-surface pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {/* EDITING STATUS BAR */}
        {editingMessage && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-700 dark:text-blue-300 animate-fade-in">
            <div className="flex items-center gap-1.5 min-w-0">
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold shrink-0">Tahrirlanmoqda:</span>
              <span className="truncate italic max-w-[220px]">&quot;{editingMessage.text}&quot;</span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition"
              title="Bekor qilish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Quick Questions Chips */}
        {!editingMessage && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {QUICK_QUESTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => appendQuestion(t(key))}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand"
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}

        {/* Input Textarea & Send Button */}
        <div className="flex items-end gap-2 mt-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => {
              // Smooth scroll into view on focus so mobile keyboard doesn't occlude input
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 200);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder={t('chat.composer.placeholder')}
            className="flex-1 min-h-[46px] max-h-32 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-sm focus:border-brand focus:outline-none transition-colors shadow-xs"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-semibold transition-all disabled:opacity-50',
              editingMessage ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' : 'bg-brand hover:bg-brand-hover text-on-brand shadow-brand'
            )}
            title={editingMessage ? 'Saqlash' : 'Yuborish'}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : editingMessage ? (
              <Check className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
