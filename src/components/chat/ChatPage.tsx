import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  Info,
  MessageSquare,
  PlusCircle,
  Send,
  Loader2
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';
import { canPublishListings } from '../../types/roles';
import { chatApi, Conversation, ConversationDetail, ChatMessage } from '../../services/chatApi';

const QUICK_QUESTION_KEYS = [
  'chat.composer.quick.viewing',
  'chat.composer.quick.address',
  'chat.composer.quick.contract',
  'chat.composer.quick.phone',
] as const;

export const ChatPage: React.FC = () => {
  const { t } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const pushToast = useAppStore((state) => state.pushToast);
  const activeConversationId = useAppStore((state) => state.activeConversationId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    
    if (!activeConversationId) {
      setLoading(true);
      chatApi.listConversations()
        .then(data => {
          if (isMounted) setConversations(data);
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
    if (detail) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [detail?.messages.length]);

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
      const newMsg = await chatApi.sendMessage(activeConversationId, draft.trim());
      setDraft('');
      setDetail(prev => prev ? { ...prev, messages: [...prev.messages, newMsg] } : prev);
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
        ) : conversations.length === 0 ? (
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
        ) : (
          <div className="mt-6 space-y-3">
            {conversations.map(conv => {
              const isOwner = conv.owner_id === currentUser.id;
              const otherPerson = isOwner ? conv.user : conv.owner;
              return (
                <button
                  key={conv.id}
                  onClick={() => setCurrentView('CHAT', null, conv.id)}
                  className="w-full text-left bg-surface border border-line rounded-xl p-4 shadow-sm hover:border-brand/50 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-content truncate">
                      {isOwner ? "Xaridor/Ijarachi" : "Uy egasi"}: {otherPerson?.name || "Foydalanuvchi"}
                    </p>
                    <p className="text-xs text-muted mt-1">Suhbat sanasi: {new Date(conv.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // DETAIL VIEW
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-3xl mx-auto px-4 py-4">
      <header className="flex items-center gap-3 pb-4 border-b border-line shrink-0">
        <button 
          onClick={() => setCurrentView('CHAT', null, null)}
          className="p-2 -ml-2 rounded-lg hover:bg-surface-2 text-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-content">{t('layout.nav.chat')}</h1>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
        ) : (
          detail?.messages.map(msg => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  isMe ? 'bg-brand text-on-brand rounded-br-sm' : 'bg-surface border border-line text-content rounded-bl-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-on-brand/70 text-right' : 'text-muted'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
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
