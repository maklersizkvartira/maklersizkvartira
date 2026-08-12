import React, { useState } from 'react';
import { 
  MessageSquare, Send, ShieldAlert, Image, MapPin, Phone, 
  CheckCheck, AlertTriangle, ShieldCheck, ExternalLink 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ChatPage: React.FC = () => {
  const { 
    activeConversationId, conversations, messages, 
    sendMessage, setCurrentView 
  } = useAppStore();

  const [inputMsg, setInputMsg] = useState('');

  const currentConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];
  const currentMsgs = messages[currentConv?.id] || [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    sendMessage(currentConv.id, inputMsg);
    setInputMsg('');
  };

  const handleQuickChip = (text: string) => {
    sendMessage(currentConv.id, text);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 min-h-[85vh] flex flex-col md:flex-row gap-6">
      {/* Left Column: Conversations List */}
      <div className="w-full md:w-80 bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" /> Xabarlar va Chat
          </h2>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => useAppStore.setState({ activeConversationId: conv.id })}
              className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${
                conv.id === currentConv?.id ? 'bg-emerald-50/70 border-l-4 border-emerald-600' : 'hover:bg-slate-50'
              }`}
            >
              <img
                src={conv.ownerAvatar}
                alt={conv.ownerName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-bold text-slate-900 truncate">{conv.ownerName}</span>
                  <span className="text-[10px] text-slate-400">{conv.lastMessageTime}</span>
                </div>
                <p className="text-xs text-slate-600 truncate">{conv.listingTitle}</p>
                <p className="text-[11px] text-slate-400 truncate mt-1 italic">{conv.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Chat Window & Input */}
      {currentConv ? (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-card flex flex-col overflow-hidden h-[650px]">
          {/* Top Chat Header with Listing Preview */}
          <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentConv.listingImage}
                alt={currentConv.listingTitle}
                className="w-12 h-10 rounded-lg object-cover border border-slate-700"
              />
              <div>
                <h3 
                  onClick={() => setCurrentView('LISTING_DETAIL', currentConv.listingId)}
                  className="font-bold text-sm text-white hover:text-emerald-400 cursor-pointer flex items-center gap-1 line-clamp-1"
                >
                  {currentConv.listingTitle} <ExternalLink className="w-3 h-3 text-slate-400" />
                </h3>
                <p className="text-xs text-emerald-400 font-mono font-semibold">
                  {new Intl.NumberFormat('uz-UZ').format(currentConv.listingPrice)} so'm/oy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-emerald-800 text-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Safety Active
              </span>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
            {/* Safety Banner */}
            <div className="bg-emerald-900/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-900 flex items-start gap-2 max-w-lg mx-auto">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Shield AI Chat Xavfsizligi Faol</span>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Platforma ichidagi muloqot xavfsiz shifrlangan. Shubhali oldindan pul talablari avtomatik aniqlanadi.
                </p>
              </div>
            </div>

            {/* Messages List */}
            {currentMsgs.map((msg) => {
              const isMe = msg.senderId === 'tenant_current';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs space-y-1 shadow-sm ${
                      isMe
                        ? 'bg-slate-900 text-white rounded-br-none'
                        : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                    }`}
                  >
                    <div className="font-semibold text-[10px] text-slate-400 flex items-center justify-between gap-4">
                      <span>{msg.senderName}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed text-sm">{msg.text}</p>

                    {/* Safety Warning Card inside chat message */}
                    {msg.isSafetyWarning && (
                      <div className="mt-2 p-2 bg-amber-500/20 border border-amber-400/50 rounded-lg text-amber-200 text-[11px] flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{msg.warningText}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action Chips */}
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Tezkor Javoblar:</span>
            {[
              "Qachon ko'rsam bo'ladi?",
              "Narxida tushib berolasizmi?",
              "Kommunal kiritilganmi?",
              "Talabalarga beriladimi?"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickChip(chip)}
                className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border border-slate-200"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Xabaringizni yozing..."
              className="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />

            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center shadow-md transition-all active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
};
