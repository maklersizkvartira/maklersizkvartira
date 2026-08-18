import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, ArrowLeft, ShieldCheck, AlertTriangle, 
  Search, ExternalLink, CheckCheck, Sparkles, Building2, Phone, Home 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ChatPage: React.FC = () => {
  const {
    activeConversationId, conversations, messages,
    sendMessage, setCurrentView, currentUser, setActiveConversation,
  } = useAppStore();

  const [inputMsg, setInputMsg] = useState('');
  const [mobileThread, setMobileThread] = useState(Boolean(activeConversationId));
  const [filterQuery, setFilterQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOwner = currentUser?.role === 'OWNER';
  const currentConv = conversations.find((c) => c.id === activeConversationId) || conversations[0] || null;
  const currentMsgs = currentConv ? (messages[currentConv.id] || []) : [];

  const peerName = (conv: typeof conversations[0]) => (isOwner ? conv.tenantName : conv.ownerName);
  const peerAvatar = (conv: typeof conversations[0]) => (isOwner ? conv.tenantAvatar : conv.ownerAvatar);

  useEffect(() => {
    if (activeConversationId) {
      setMobileThread(true);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMsgs.length, mobileThread]);

  const openConv = (id: string) => {
    setActiveConversation(id);
    setMobileThread(true);
  };

  const handleSend = (textToSend?: string) => {
    const msgText = textToSend || inputMsg;
    if (!msgText.trim() || !currentConv) return;
    sendMessage(currentConv.id, msgText.trim());
    if (!textToSend) setInputMsg('');
  };

  const isMe = (senderId: string, senderRole: string) => {
    if (currentUser?.id) {
      return senderId === currentUser.id;
    }
    if (isOwner) return senderRole === 'OWNER';
    return senderRole === 'TENANT';
  };

  const filteredConversations = conversations.filter((c) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      peerName(c).toLowerCase().includes(q) ||
      c.listingTitle.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  });

  const QuickChips = [
    "📅 Bugun uyni ko'rsam bo'ladimi?",
    "📍 Aniq manzil va mo'ljalni yuboring",
    "📜 Shartnoma rasmiylashtiriladimi?",
  ];

  const List = (
    <div className="bg-white md:rounded-3xl md:border md:border-slate-200/80 shadow-card flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span>Xabarlar</span>
          </h2>
          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
            {conversations.length} suhbat
          </span>
        </div>

        {/* Filter Input */}
        <div className="relative">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Ism yoki e'lon bo'yicha izlash..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
        </div>
      </div>

      {/* Conversation Cards */}
      <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-slate-100">
        {filteredConversations.length > 0 ? (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === currentConv?.id;
            return (
              <button
                key={conv.id}
                onClick={() => openConv(conv.id)}
                className={`w-full text-left p-3.5 flex items-start gap-3 transition-all ${
                  isSelected ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <img src={peerAvatar(conv)} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-200 shadow-sm" />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-slate-900 text-xs truncate">{peerName(conv)}</span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{conv.lastMessageTime}</span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700 truncate mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{conv.listingTitle}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1 leading-snug">{conv.lastMessage}</p>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">Suhbatlar topilmadi</div>
        )}
      </div>
    </div>
  );

  const Thread = currentConv ? (
    <div className="bg-white md:rounded-3xl md:border md:border-slate-200/80 shadow-card flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Top Peer Info Header */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-2.5 shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileThread(false)}
            className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 shrink-0"
            aria-label="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <img src={peerAvatar(currentConv)} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-xs sm:text-sm truncate">{peerName(currentConv)}</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>{isOwner ? 'Ijarachi' : 'Uy Egasi'}</span>
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">Onlayn • Maklersiz aloqa</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('LISTING_DETAIL', currentConv.listingId)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] sm:text-xs px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl flex items-center gap-1 transition shrink-0 active:scale-95 shadow-sm"
        >
          <Home className="w-3.5 h-3.5" />
          <span>E'lon</span>
        </button>
      </div>

      {/* Compact Active Listing Banner */}
      <div className="bg-slate-950 text-white px-3.5 py-2 flex items-center justify-between gap-2.5 shrink-0 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <img src={currentConv.listingImage} alt="" className="w-7 h-7 rounded-md object-cover shrink-0 border border-slate-700" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-100 truncate">{currentConv.listingTitle}</div>
            <div className="text-[10px] font-extrabold text-emerald-400">
              {(currentConv.listingPrice / 1000000).toFixed(1)} mln so'm / oy
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('LISTING_DETAIL', currentConv.listingId)}
          className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold flex items-center gap-0.5 shrink-0 hover:underline"
        >
          <span>Ko'rish</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Compact Safety Warning */}
      <div className="bg-amber-50/90 border-b border-amber-200 px-3 py-1.5 text-[10px] font-medium text-amber-900 flex items-center gap-1.5 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="truncate">Uyni ko'rmasdan oldindan plastik kartaga pul o'tkazmang!</span>
      </div>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:p-4 space-y-3 bg-slate-100/70 min-h-0">
        {currentMsgs.map((msg) => {
          const mine = isMe(msg.senderId, msg.senderRole);
          return (
            <div key={msg.id} className={`flex w-full ${mine ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
              <div
                className={`max-w-[82%] sm:max-w-[72%] px-3.5 py-2.5 rounded-2xl text-[13px] sm:text-sm shadow-sm leading-relaxed break-words [word-break:break-word] ${
                  mine
                    ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-tr-xs shadow-emerald-600/10'
                    : 'bg-white text-slate-900 border border-slate-200/90 rounded-tl-xs'
                }`}
              >
                {!mine && (
                  <div className="text-[10px] font-extrabold text-emerald-700 mb-0.5 flex items-center gap-1">
                    <span>{msg.senderName}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                <div className={`text-[9.5px] sm:text-[10px] mt-1 flex items-center justify-end gap-1 font-medium ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                  <span>{msg.timestamp}</span>
                  {mine && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Suggestion Chips */}
      <div className="px-2.5 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto hide-scrollbar shrink-0">
        {QuickChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(chip)}
            className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0 border border-slate-200/80 transition-all active:scale-95 whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2 sm:p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-16 sm:pb-3"
      >
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Xabaringizni yozing..."
          className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim()}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center bg-white rounded-3xl border border-slate-200/80 text-slate-400 text-sm font-semibold p-8 text-center">
      <div>
        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <p>Chap tomondan suhbatni tanlang</p>
      </div>
    </div>
  );

  return (
    <div className="md:max-w-6xl md:mx-auto md:px-6 md:py-6 w-full">
      <div className="h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-7rem)] md:min-h-[580px] flex md:gap-4">
        <div className={`${mobileThread ? 'hidden' : 'flex'} md:flex w-full md:w-80 flex-col min-h-0`}>
          {List}
        </div>
        <div className={`${mobileThread ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0`}>
          {Thread}
        </div>
      </div>
    </div>
  );
};
