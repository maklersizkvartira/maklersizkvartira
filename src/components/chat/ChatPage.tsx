import React, { useState } from 'react';
import { MessageSquare, Send, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ChatPage: React.FC = () => {
  const {
    activeConversationId, conversations, messages,
    sendMessage, setCurrentView, currentUser, setActiveConversation,
  } = useAppStore();

  const [inputMsg, setInputMsg] = useState('');
  const [mobileThread, setMobileThread] = useState(false);

  const isOwner = currentUser?.role === 'OWNER';
  const currentConv = conversations.find((c) => c.id === activeConversationId) || null;
  const currentMsgs = currentConv ? (messages[currentConv.id] || []) : [];

  const peerName = (conv: typeof conversations[0]) => (isOwner ? conv.tenantName : conv.ownerName);
  const peerAvatar = (conv: typeof conversations[0]) => (isOwner ? conv.tenantAvatar : conv.ownerAvatar);

  const openConv = (id: string) => {
    setActiveConversation(id);
    setMobileThread(true);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !currentConv) return;
    sendMessage(currentConv.id, inputMsg);
    setInputMsg('');
  };

  const isMe = (senderId: string, senderRole: string) => {
    if (currentUser?.id && senderId === currentUser.id) return true;
    if (isOwner) return senderRole === 'OWNER';
    return senderRole !== 'OWNER';
  };

  const List = (
    <div className="bg-white md:rounded-2xl md:border md:border-slate-200 flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" /> Xabarlar
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">{conversations.length} ta suhbat</p>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => openConv(conv.id)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-50 ${
              conv.id === currentConv?.id ? 'bg-emerald-50' : 'bg-white'
            }`}
          >
            <div className="relative shrink-0">
              <img src={peerAvatar(conv)} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-200" />
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 truncate">{peerName(conv)}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{conv.lastMessageTime}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{conv.listingTitle}</p>
              <p className="text-xs text-slate-600 truncate mt-0.5">{conv.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const Thread = currentConv ? (
    <div className="bg-white md:rounded-2xl md:border md:border-slate-200 flex flex-col h-full min-h-0">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileThread(false)}
          className="md:hidden p-2 rounded-full bg-slate-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={peerAvatar(currentConv)} alt="" className="w-10 h-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="font-black text-slate-900 truncate">{peerName(currentConv)}</div>
          <button
            type="button"
            onClick={() => setCurrentView('LISTING_DETAIL', currentConv.listingId)}
            className="text-[11px] text-emerald-700 font-bold truncate block w-full text-left"
          >
            {currentConv.listingTitle}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50 min-h-0">
        <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-[11px] text-emerald-900 flex gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>Ko'rmasdan kartaga pul o'tkazmang.</span>
        </div>
        {currentMsgs.map((msg) => {
          const mine = isMe(msg.senderId, msg.senderRole);
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] p-3 rounded-2xl text-sm shadow-sm ${
                mine ? 'bg-emerald-700 text-white rounded-br-md' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md'
              }`}>
                {!mine && <div className="text-[10px] font-bold text-emerald-700 mb-0.5">{msg.senderName}</div>}
                <p className="leading-relaxed">{msg.text}</p>
                <div className={`text-[10px] mt-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>{msg.timestamp}</div>
                {msg.isSafetyWarning && (
                  <div className="mt-2 p-2 bg-amber-50 text-amber-800 rounded-lg text-[11px] flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {msg.warningText}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-2.5">
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Xabar yozing..."
          className="flex-1 bg-slate-100 rounded-full px-4 py-3 text-sm font-medium"
        />
        <button type="submit" className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 text-sm">Suhbatni tanlang</div>
  );

  return (
    <div className="md:max-w-6xl md:mx-auto md:px-6 md:py-6">
      <div className="h-[calc(100dvh-3.5rem-4.25rem)] md:h-[calc(100dvh-6rem)] md:min-h-[540px] flex md:gap-4">
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
