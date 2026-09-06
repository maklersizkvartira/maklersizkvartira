'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Headphones,
  Search,
  CheckCircle2,
  RotateCcw,
  Send,
  Loader2,
  Phone,
  Shield,
  MessageSquare,
  RefreshCw,
  ArrowLeft,
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

/**
 * The four canned replies, as message keys.
 *
 * They were four Uzbek sentence literals in a panel that ships uz, ru and en —
 * so a Russian-speaking operator was offered Uzbek boilerplate to paste to a
 * Russian-speaking customer. The keys resolve inside the component, where the
 * translator is.
 */
const QUICK_REPLY_KEYS = ['quick1', 'quick2', 'quick3', 'quick4'] as const;


const playSupportNotificationSound = () => {
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
    osc.onended = () => { void ctx.close(); };
  } catch {
    // Ignore audio errors
  }
};

export default function SupportPage() {
  const t = useTranslations('support');
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSupportDetail | null>(null);
  /**
   * Which question each piece of loaded state is the ANSWER to.
   *
   * These replace a pair of `loading` booleans that had to be switched on
   * inside an effect body — a cascading render, and an ESLint error that made
   * `npm run lint` exit non-zero for the whole admin app. A flag that says
   * "what is on screen was loaded for X" answers the same question without
   * writing state during an effect, and answers it more honestly: it cannot
   * drift out of step with the selection the way a boolean can.
   */
  const [loadedStatus, setLoadedStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED' | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  /** The refresh button's own spinner; it is not the initial load. */
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /**
   * Which customer the pane is FOR, readable from a callback that has already
   * closed over a stale value.
   *
   * The thread poll's guard was `res.user_id !== selectedUserId`, where
   * `selectedUserId` is whatever the effect closed over when the interval was
   * created. Clearing the interval on a thread switch does not cancel the
   * request it has already started, so that request resolved holding the
   * PREVIOUS customer's id, compared it against itself, passed, and was
   * adopted — the pane went back to the previous customer while the composer
   * went on posting to the new one. A ref is the only value a late callback
   * can read that is guaranteed to be current.
   */
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedUserId;
  }, [selectedUserId]);
  /** Guards the foreground thread fetch against its own races. */
  const chatReqRef = useRef(0);

  /**
   * What the chat pane is allowed to render.
   *
   * Derived rather than cleared. `detail` used to be left alone on a thread
   * switch, so between the tap and the response — and for ever, if that
   * response failed — the header showed the previous customer's name, phone
   * and status and the list showed their messages, while every reply typed
   * underneath was posted to the newly selected customer. Deriving it closes
   * the window entirely: there is no instant at which a mismatched thread can
   * be on screen, because a mismatched thread is not rendered at all.
   */
  const activeDetail = detail && detail.user_id === selectedUserId ? detail : null;
  const loadingList = loadedStatus !== statusFilter || refreshing;
  const loadingChat = selectedUserId !== null && loadedUserId !== selectedUserId;

  /**
   * The fetches, with no state writes inside them.
   *
   * Separating the request from the write is what lets every caller — an
   * effect, a poll, a retry button — decide for itself whether the answer is
   * still wanted.
   */
  const fetchConversations = (status: 'ALL' | 'OPEN' | 'RESOLVED') =>
    http.get<AdminSupportConversation[]>(
      api.support.conversations({ status: status === 'ALL' ? undefined : status }),
    );

  const fetchThread = (userId: string) =>
    http.get<AdminSupportDetail>(api.support.messages(userId));

  /** The refresh button. The effect below owns the automatic load. */
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
        // Marked loaded either way. A filter whose request failed is not still
        // loading, and leaving the spinner up for ever is not an error message.
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
        setConversations((prev) =>
          prev.map((c) => (c.user_id === wanted ? { ...c, unread_count: 0 } : c)),
        );
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

  // Scroll to bottom on message update.
  //
  // Keyed on the thread as well as the message count. It used to depend on the
  // count alone, so switching between two conversations that happened to hold
  // the same number of messages never re-ran it and the new thread opened at
  // the previous thread's scroll offset — halfway up somebody else's history.
  useEffect(() => {
    if (activeDetail?.messages?.length) {
      // block: 'nearest' keeps the scroll inside the message list. Without it the browser
      // is free to scroll the document too, which yanked the whole dashboard shell around
      // every time a new message arrived.
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeDetail?.id, activeDetail?.messages?.length]);

  // Real-time automatic background polling for active conversation
  useEffect(() => {
    if (!selectedUserId) return;

    const intervalId = setInterval(async () => {
      // A backgrounded tab still ran this poll forever, so a phone left on the support
      // screen kept hitting an unpaginated endpoint every 2.5s for nothing.
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetchThread(selectedUserId);
        if (!res) return;
        // Against the ref, not the closure. `selectedUserId` here is whatever
        // this interval was created with; by the time a request that started
        // before a thread switch resolves, it is the PREVIOUS customer — and
        // comparing the response against it passed, which is exactly how the
        // previous customer's thread reappeared over the current one.
        if (res.user_id !== selectedRef.current) return;
        setDetail((prev) => {
          if (!prev) return res;
          // Showing a different customer than the one selected: adopt outright.
          // Comparing two different threads by length is meaningless, and a
          // shorter correct thread used to lose to a longer stale one and stay
          // on screen indefinitely. Returning here also keeps the chime from
          // firing on a thread swap.
          if (res.user_id !== prev.user_id) return res;

          // By id, not by count.
          //
          // `handleSendReply` appends the message it just posted, and a poll
          // that lands between the server committing that message and the POST
          // returning already carries it — so the thread held it twice, and
          // from then on the local count was permanently one ahead of the
          // server's. The old `res.messages.length > prev.messages.length`
          // test could then never be true again: the operator stopped seeing
          // incoming customer messages entirely, with nothing to indicate it.
          const known = new Set(prev.messages.map((m) => m.id));
          const arrived = res.messages.filter((m) => !known.has(m.id));
          if (arrived.length > 0) {
            if (arrived.some((m) => m.sender_type === 'USER')) {
              playSupportNotificationSound();
            }
            // The server's copy is the truth, plus anything of ours it has not
            // caught up with yet — an optimistic reply must not vanish and
            // reappear.
            const server = new Set(res.messages.map((m) => m.id));
            const pending = prev.messages.filter((m) => !server.has(m.id));
            return { ...res, messages: [...res.messages, ...pending] };
          }
          if (res.status !== prev.status) {
            return { ...prev, status: res.status };
          }
          return prev;
        });
      } catch {
        // Silently ignore background polling errors
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [selectedUserId]);

  // Real-time automatic background polling for conversations list
  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Same reason as the thread poll: do not refetch the whole conversation graph while
      // nobody is looking at the tab.
      if (document.visibilityState !== 'visible') return;
      try {
        const activeStatus = statusFilter === 'ALL' ? undefined : statusFilter;
        const res = await http.get<AdminSupportConversation[]>(
          api.support.conversations({ status: activeStatus })
        );
        if (res) {
          setConversations(res);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [statusFilter]);

  // Send admin reply
  const handleSendReply = async () => {
    const target = selectedUserId;
    if (!replyText.trim() || !target || sending) return;
    setSending(true);
    try {
      const res = await http.post<AdminSupportMessage>(
        api.support.sendReply(target),
        { text: replyText.trim() },
      );
      setReplyText('');
      setDetail((prev) => {
        // Only into the thread it was sent to. Without this check a reply that
        // resolved after the operator had already moved on was appended to
        // whichever conversation happened to be open.
        if (!prev || prev.user_id !== target) return prev;
        // De-duplicated: the 2.5s poll may already have picked this message up
        // between the server committing it and this response arriving, and a
        // message held twice also left the local count permanently ahead of
        // the server's, which silenced the poll for the rest of the session.
        if (prev.messages.some((m) => m.id === res.id)) return prev;
        return { ...prev, messages: [...prev.messages, res] };
      });
      // Update snippet in list
      setConversations((prev) =>
        prev.map((c) =>
          c.user_id === target
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
      toast.error(t('errors.send'));
    } finally {
      setSending(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async () => {
    // Both, and they must agree. The next status was read off `detail` while
    // the PATCH went to `selectedUserId`; with `detail` not cleared on a thread
    // switch those were routinely two different customers, so the button wrote
    // the previous conversation's inverted status onto the newly selected one.
    // `detail` is cleared now, and this is the belt to that braces.
    if (!selectedUserId || !activeDetail || activeDetail.user_id !== selectedUserId) return;
    const target = selectedUserId;
    const nextStatus = activeDetail.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
    try {
      await http.patch(api.support.updateStatus(target), { status: nextStatus });
      setDetail((prev) => (prev && prev.user_id === target ? { ...prev, status: nextStatus } : prev));
      setConversations((prev) =>
        prev.map((c) => (c.user_id === target ? { ...c, status: nextStatus } : c))
      );
      toast.success(t('statusChanged'));
    } catch {
      toast.error(t('errors.status'));
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
    // The shell already offsets every page by --header-height and pads it with px/py, so this
    // page must subtract exactly those and add none of its own. The old `h-[calc(100vh-80px)]`
    // plus a second `p-4 md:p-6` guessed a 80px header (it is 58px) and ignored the shell's
    // vertical padding, which overflowed the viewport and made the whole dashboard scroll behind
    // an already-scrolling conversation list. 100dvh instead of 100vh so mobile browser chrome
    // does not eat another 60-100px.
    //
    // The three steps mirror DashboardLayout's padding exactly, which is no longer symmetric
    // now that it reserves the mobile dock's clearance at the bottom: pt-8 + pb-6rem = 8rem
    // below 1024px, lg:pt-12 + pb-6rem = 9rem at exactly 1024px (iPad landscape, where the
    // dock's own `max-width: 1024px` query still applies), and lg:pt-12 + min-[1025px]:pb-12
    // = 6rem from 1025px up. Subtracting the old symmetric 4rem/6rem here left the page 4rem
    // taller than its box and the document scrolled again.
    <div className="flex h-[calc(100dvh-var(--header-height)-8rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--header-height)-9rem-env(safe-area-inset-bottom))] min-[1025px]:h-[calc(100dvh-var(--header-height)-6rem)] flex-col gap-4">
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
          onClick={() => void reloadConversations()}
          disabled={loadingList}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loadingList && 'animate-spin')} />
          {t('refresh')}
        </button>
      </div>

      {/* Main Container */}
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        {/* Left Column: Customers List — the master half of the mobile master/detail. Below md
            it owns the whole panel until a customer is tapped, then it steps aside for the
            thread; from md up both halves are always visible side by side. */}
        <div
          className={cn(
            'w-full md:w-80 lg:w-96 flex-col border-r border-neutral-200 dark:border-neutral-800',
            selectedUserId ? 'hidden md:flex' : 'flex'
          )}
        >
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
              {/* text-base below md for the same reason globals.css bumps .input-field: iOS
                  Safari zooms the page whenever a focused field is under 16px, and on a phone
                  this list is now the whole screen. */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-2 pl-9 pr-3 text-base md:text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-100 dark:focus:border-blue-500"
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
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {t('senderYou')}:{' '}
                          </span>
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

        {/* Right Column: Active Chat Stream — the detail half. This used to be `hidden md:flex`
            unconditionally, so on a phone tapping a customer fired the fetch (which marks the
            thread read server-side) and then rendered nothing at all: support was completely
            unusable on the owner's primary device. */}
        <div
          className={cn(
            'flex-1 flex-col min-h-0 bg-neutral-50/40 dark:bg-neutral-950/20',
            selectedUserId ? 'flex' : 'hidden md:flex'
          )}
        >
          {/* Mobile back control. It sits above the branches below on purpose — while the
              thread is loading or failed to load there is no chat header to hang it off, and
              without it the pushed-in detail view would be a dead end with the list off screen.
              Clearing the selection is enough: the effect above resets `detail` on null. The
              label is hardcoded like the rest of this page's copy — see the note about the
              missing `support` catalogue keys. */}
          {selectedUserId && (
            <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-2 py-2 md:hidden dark:border-neutral-800 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Murojaatlar
              </button>
            </div>
          )}

          {!selectedUserId ? (
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
          ) : !activeDetail ? (
            // A customer is selected but the thread has not arrived (or the fetch failed).
            // On mobile this is a whole screen, so it needs its own state rather than falling
            // through to the "pick a customer" placeholder next to a back button.
            <div className="flex flex-1 items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : (
            <>
              {/* Chat Header — tighter gutters below md, because on a phone this header shares
                  a 360px row with the status toggle and the desktop px-5 left no room for the
                  customer's name. */}
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-3 md:px-5 md:py-3.5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {activeDetail.user?.avatar ? (
                      <img
                        src={activeDetail.user.avatar}
                        alt=""
                        className="h-10 w-10 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-xs">
                        {activeDetail.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {activeDetail.user?.name || 'Foydalanuvchi'}
                      </h2>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          activeDetail.status === 'OPEN'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        )}
                      >
                        {activeDetail.status === 'OPEN' ? t('statusOpen') : t('statusResolved')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <a
                        href={`tel:${activeDetail.user?.phone}`}
                        className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {activeDetail.user?.phone || '—'}
                      </a>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {activeDetail.user?.role || 'User'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status toggle action */}
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors',
                    activeDetail.status === 'OPEN'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                  )}
                >
                  {activeDetail.status === 'OPEN' ? (
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
                  activeDetail.messages.map((msg) => {
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
                            {activeDetail.user?.avatar ? (
                              <img
                                src={activeDetail.user.avatar}
                                alt=""
                                className="h-7 w-7 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                                {activeDetail.user?.name?.slice(0, 1) || 'U'}
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
                              {t('senderOperator')}
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
                  {QUICK_REPLY_KEYS.map((key) => {
                    const text = t(key);
                    return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReplyText((prev) => (prev ? `${prev} ${text}` : text))}
                      className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:border-blue-500 dark:hover:text-blue-300"
                    >
                      {text}
                    </button>
                    );
                  })}
                </div>

                <div className="flex items-end gap-2">
                  {/* text-base below md, as above — a 12px composer is exactly the field that
                      triggers the iOS Safari focus-zoom while the operator is typing a reply. */}
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
                    className="min-w-0 flex-1 resize-none rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-base md:text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-100 dark:focus:border-blue-500"
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
