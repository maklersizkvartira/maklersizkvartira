'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Headphones,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
  Loader2,
  User as UserIcon,
  Phone,
  Shield,
  MessageSquare,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import { toast } from '@/shared/ui/Toast';

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

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

const QUICK_REPLIES = [
  'Assalomu alaykum! Sizga qanday yordam bera olamiz?',
  'Murojaatingiz qabul qilindi. Tez orada masalani koʻrib chiqib javob beramiz.',
  'Iltimos, eʼloningiz sarlavhasi yoki ID raqamini yozib yuborsangiz.',
  'Muammo muvaffaqiyatli bartaraf etildi. Platformamizdan foydalanganingiz uchun rahmat!',
];

export default function SupportPage() {
  const t = useTranslations('support');
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSupportDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = async (statusParam?: string) => {
    setLoadingList(true);
    try {
      const activeStatus = statusParam ?? (statusFilter === 'ALL' ? undefined : statusFilter);
      const res = await http.get<AdminSupportConversation[]>(
        api.support.conversations({ status: activeStatus })
      );
      setConversations(res || []);
    } catch {
      toast.error('Murojaatlar roʻyxatini yuklashda xatolik yuz berdi');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [statusFilter]);

  // Load selected conversation messages
  const loadMessages = async (userId: string) => {
    setLoadingChat(true);
    try {
      const res = await http.get<AdminSupportDetail>(api.support.messages(userId));
      setDetail(res);
      // Decrement unread in local list
      setConversations((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, unread_count: 0 } : c))
      );
    } catch {
      toast.error('Suhbat xabarlarini yuklashda xatolik yuz berdi');
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
    } else {
      setDetail(null);
    }
  }, [selectedUserId]);

  // Scroll to bottom on message update
  useEffect(() => {
    if (detail?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [detail?.messages?.length]);

  // Send admin reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedUserId || sending) return;
    setSending(true);
    try {
      const res = await http.post<AdminSupportMessage>(
        api.support.sendReply(selectedUserId),
        { text: replyText.trim() }
      );
      setReplyText('');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, res],
            }
          : prev
      );
      // Update snippet in list
      setConversations((prev) =>
        prev.map((c) =>
          c.user_id === selectedUserId
            ? {
                ...c,
                last_message: res.text,
                last_message_at: res.created_at,
                last_message_sender: 'ADMIN',
              }
            : c
        )
      );
      toast.success(t('replySent'));
    } catch {
      toast.error('Xabarni yuborishda xatolik yuz berdi');
    } finally {
      setSending(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async () => {
    if (!selectedUserId || !detail) return;
    const nextStatus = detail.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    try {
      await http.patch(api.support.updateStatus(selectedUserId), undefined);
      setDetail((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      setConversations((prev) =>
        prev.map((c) => (c.user_id === selectedUserId ? { ...c, status: nextStatus } : c))
      );
      toast.success(t('statusChanged'));
    } catch {
      toast.error('Holatni oʻzgartirishda xatolik yuz berdi');
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      const nameMatch = conv.user?.name?.toLowerCase().includes(query);
      const phoneMatch = conv.user?.phone?.toLowerCase().includes(query);
      const messageMatch = conv.last_message?.toLowerCase().includes(query);
      return Boolean(nameMatch || phoneMatch || messageMatch);
    });
  }, [conversations, searchQuery]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Headphones className="h-5 w-5 stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {t('title')}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {t('subtitle')}
          </p>
        </div>

        <button
          onClick={() => loadConversations()}
          disabled={loadingList}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loadingList && 'animate-spin')} />
          Yangilash
        </button>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        {/* Left Column: Customers List */}
        <div className="flex w-full md:w-80 lg:w-96 flex-col border-r border-neutral-200 dark:border-neutral-800">
          {/* Status Tabs & Search */}
          <div className="border-b border-neutral-200 p-3 space-y-2.5 dark:border-neutral-800">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/60">
              {(['ALL', 'OPEN', 'RESOLVED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    'rounded-lg py-1.5 text-xs font-medium transition-all text-center',
                    statusFilter === tab
                      ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-700 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {tab === 'ALL' ? t('all') : tab === 'OPEN' ? t('open') : t('resolved')}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-100 dark:focus:border-blue-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {loadingList && conversations.length === 0 ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <MessageSquare className="h-8 w-8 text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {t('noConversations')}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedUserId === conv.user_id;
                const unread = conv.unread_count > 0;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedUserId(conv.user_id)}
                    className={cn(
                      'flex w-full items-start gap-3 p-3.5 text-left transition-colors',
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/30'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    )}
                  >
                    <div className="relative shrink-0">
                      {conv.user?.avatar ? (
                        <img
                          src={conv.user.avatar}
                          alt=""
                          className="h-10 w-10 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs">
                          {conv.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                      )}
                      {unread && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow-xs">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="truncate text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {conv.user?.name || 'Foydalanuvchi'}
                        </p>
                        {conv.last_message_at && (
                          <time className="shrink-0 text-[10px] text-neutral-400">
                            {new Date(conv.last_message_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {conv.user?.phone || '—'}
                        </span>
                        <span
                          className={cn(
                            'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                            conv.status === 'OPEN' ? 'bg-emerald-500' : 'bg-neutral-400'
                          )}
                        />
                      </div>

                      <p
                        className={cn(
                          'mt-1 truncate text-xs',
                          unread
                            ? 'font-semibold text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-500 dark:text-neutral-400'
                        )}
                      >
                        {conv.last_message_sender === 'ADMIN' && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Siz: </span>
                        )}
                        {conv.last_message || '...'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Chat Stream */}
        <div className="hidden md:flex flex-1 flex-col min-h-0 bg-neutral-50/40 dark:bg-neutral-950/20">
          {!selectedUserId || !detail ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 mb-3 shadow-xs">
                <Headphones className="h-8 w-8 stroke-[1.8]" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {t('title')}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                {t('selectConversation')}
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {detail.user?.avatar ? (
                      <img
                        src={detail.user.avatar}
                        alt=""
                        className="h-10 w-10 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs">
                        {detail.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {detail.user?.name || 'Foydalanuvchi'}
                      </h2>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          detail.status === 'OPEN'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        )}
                      >
                        {detail.status === 'OPEN' ? t('statusOpen') : t('statusResolved')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <a
                        href={`tel:${detail.user?.phone}`}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {detail.user?.phone || '—'}
                      </a>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {detail.user?.role || 'User'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status toggle action */}
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors',
                    detail.status === 'OPEN'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                  )}
                >
                  {detail.status === 'OPEN' ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('markResolved')}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t('markOpen')}
                    </>
                  )}
                </button>
              </div>

              {/* Chat Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {loadingChat ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  </div>
                ) : (
                  detail.messages.map((msg) => {
                    const isAdmin = msg.sender_type === 'ADMIN';

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex w-full items-end gap-2',
                          isAdmin ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {!isAdmin && (
                          <div className="shrink-0">
                            {detail.user?.avatar ? (
                              <img
                                src={detail.user.avatar}
                                alt=""
                                className="h-7 w-7 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                                {detail.user?.name?.slice(0, 1) || 'U'}
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-xs text-xs sm:text-sm',
                            isAdmin
                              ? 'rounded-br-xs bg-blue-600 text-white'
                              : 'rounded-bl-xs border border-neutral-200/80 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
                          )}
                        >
                          {isAdmin && (
                            <p className="mb-0.5 text-[10px] font-bold text-blue-200">
                              Operator (Siz)
                            </p>
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                          <p
                            className={cn(
                              'mt-1 text-[10px]',
                              isAdmin ? 'text-blue-200 text-right' : 'text-neutral-400 text-left'
                            )}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        {isAdmin && (
                          <div className="shrink-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white text-xs shadow-xs">
                              <Headphones className="h-3.5 w-3.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Composer & Quick Replies */}
              <div className="border-t border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900 space-y-2">
                {/* Quick replies chip carousel */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {QUICK_REPLIES.map((text, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyText((prev) => (prev ? `${prev} ${text}` : text))}
                      className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    rows={2}
                    placeholder={t('replyPlaceholder')}
                    className="flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-100 dark:focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
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
