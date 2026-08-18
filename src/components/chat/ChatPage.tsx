import React, { useState } from 'react';
import { MessageSquare, Send, ArrowLeft, ShieldCheck, AlertTriangle, PlusCircle, Home, ExternalLink, PhoneCall, Share2, X, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Listing } from '../../types';

export const ChatPage: React.FC = () => {
  const {
    activeConversationId, conversations, messages, listings,
    sendMessage, setCurrentView, currentUser, setActiveConversation, setShowAuth
  } = useAppStore();

  const [inputMsg, setInputMsg] = useState('');
  const [mobileThread, setMobileThread] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const isOwner = currentUser?.role === 'OWNER';
  const currentConv = conversations.find((c) => c.id === activeConversationId) || null;
  const currentMsgs = currentConv ? (messages[currentConv.id] || []) : [];
  const currentListing = listings.find((l) => l.id === currentConv?.listingId);

  const peerName = (conv: typeof conversations[0]) => (isOwner ? conv.tenantName : conv.ownerName);
  const peerAvatar = (conv: typeof conversations[0]) => (isOwner ? conv.tenantAvatar : conv.ownerAvatar);

  const openConv = (id: string) => {
    setActiveConversation(id);
    setMobileThread(true);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim() || !currentConv) return;
    sendMessage(currentConv.id, inputMsg);
    setInputMsg('');
  };

  const sendQuickReply = (text: string) => {
    if (!currentConv) return;
    sendMessage(currentConv.id, text);
  };

  const handleShareListing = (listing: Listing) => {
    if (!currentConv) return;
    sendMessage(
      currentConv.id,
      `🏠 E'lon ulashildi: ${listing.title} (${listing.price.toLocaleString()} so'm/oy)`,
      {
        listingData: {
          id: listing.id,
          title: listing.title,
          price: listing.price,
          image: listing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=300',
          district: listing.district,
          rooms: listing.rooms,
        }
      }
    );
    setShowShareModal(false);
  };

  const handleOpenCreateListing = () => {
    if (!currentUser) {
      setShowAuth(true);
      return;
    }
    if (currentUser.role !== 'OWNER') {
      alert("E'lon joylash uchun profil sozlamalarida 'Uy Egasi' roliga ega bo'lishingiz kerak.");
      return;
    }
    setCurrentView('CREATE_LISTING');
  };

  const isMe = (senderId: string, senderRole: string) => {
    if (currentUser?.id && senderId === currentUser.id) return true;
    if (isOwner) return senderRole === 'OWNER';
    return senderRole !== 'OWNER';
  };

  const List = (
    <div className="bg-white md:rounded-2xl md:border md:border-slate-200 flex flex-col h-full min-h-0">
      <div className="px-4 py-3.5 border-b border-slate-100 shrink-0 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" /> Xabarlar
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{conversations.length} ta faol suhbat</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreateListing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>E'lon Joylash</span>
        </button>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 divide-y divide-slate-100">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => openConv(conv.id)}
            className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors ${
              conv.id === currentConv?.id ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600' : 'bg-white hover:bg-slate-50'
            }`}
          >
            <div className="relative shrink-0">
              <img src={peerAvatar(conv)} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-200 border border-slate-200" />
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm truncate">{peerName(conv)}</span>
                <span className="text-[11px] text-slate-400 font-semibold shrink-0">{conv.lastMessageTime}</span>
              </div>
              <p className="text-xs font-semibold text-emerald-700 truncate mt-0.5 flex items-center gap-1">
                <Home className="w-3 h-3 shrink-0" />
                <span>{conv.listingTitle}</span>
              </p>
              <p className="text-xs text-slate-600 truncate mt-1">{conv.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const Thread = currentConv ? (
    <div className="bg-white md:rounded-2xl md:border md:border-slate-200 flex flex-col h-full min-h-0 relative">
      {/* Top Header */}
      <div className="px-3.5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 bg-white">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileThread(false)}
            className="md:hidden p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={peerAvatar(currentConv)} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-slate-900 text-sm truncate">{peerName(currentConv)}</div>
            <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Onlayn • Maklersiz bevosita muloqot</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPhoneModal(true)}
            className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Qo'ng'iroq</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('LISTING_DETAIL', currentConv.listingId)}
            className="bg-slate-900 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">E'lonni Ochish</span>
          </button>
        </div>
      </div>

      {/* Mini Listing Header Banner inside Chat */}
      {currentListing && (
        <div className="bg-slate-900 text-white p-3 flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={currentListing.images[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=200'}
              alt=""
              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-xs text-white truncate">{currentListing.title}</h4>
              <p className="text-[11px] text-emerald-400 font-black mt-0.5">
                {currentListing.price.toLocaleString()} so'm/oy
                {currentListing.district ? ` • ${currentListing.district}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleShareListing(currentListing)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all"
              title="Kvartira kartasini chatga ulashish"
            >
              <Share2 className="w-3 h-3" />
              <span className="hidden sm:inline">Karta Yuborish</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50 min-h-0">
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-900 flex gap-2.5 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-extrabold text-emerald-950 block">Xavfsiz muloqot qoidasi:</span>
            <p className="text-emerald-800 leading-relaxed text-[11px]">
              Kvartirani shaxsan ko'rib, kalit va hujjatlarni olmaguningizcha oldindan karta (plastik)ga pul o'tkazmang!
            </p>
          </div>
        </div>

        {currentMsgs.map((msg) => {
          const mine = isMe(msg.senderId, msg.senderRole);
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-sm shadow-sm ${
                mine ? 'bg-emerald-700 text-white rounded-br-md' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md'
              }`}>
                {!mine && <div className="text-[10px] font-extrabold text-emerald-700 mb-1">{msg.senderName}</div>}

                {/* Listing Attachment Card in Chat Message */}
                {msg.listingData && (
                  <div className="mb-2.5 bg-slate-900 text-white rounded-xl p-2.5 border border-slate-700 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <img src={msg.listingData.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-xs truncate text-white">{msg.listingData.title}</div>
                        <div className="text-emerald-400 font-black text-xs mt-0.5">
                          {msg.listingData.price.toLocaleString()} so'm/oy
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentView('LISTING_DETAIL', msg.listingData?.id || null)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>E'lonni batafsil ko'rish</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div className={`text-[10px] font-semibold mt-1 text-right ${mine ? 'text-emerald-200' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </div>

                {msg.isSafetyWarning && (
                  <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] flex gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{msg.warningText}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Reply Chips */}
      <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {[
          "📍 Aniq manzil va metro joylashuvi?",
          "💰 Oylik va depozit qancha?",
          "🔑 Bugun borib ko'rsam bo'ladimi?",
          "📞 Telefon raqamingizni bera olasizmi?"
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => sendQuickReply(chip)}
            className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0 border border-slate-200 transition-colors whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Input Bar */}
      <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:pb-2.5">
        <button
          type="button"
          onClick={() => setShowShareModal(true)}
          className="p-2.5 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition-colors shrink-0"
          title="Kvartira e'lonini ulashish"
        >
          <Home className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Xabar yozing..."
          className="flex-1 bg-slate-100 focus:bg-white focus:ring-2 focus:ring-emerald-500 border border-slate-200 rounded-full px-4 py-3 text-sm font-semibold outline-none transition-all"
        />

        <button
          type="submit"
          className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {/* Share Listing Modal inside Chat */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-600" /> E'lonni Chatga Yuborish
              </h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">Qaysi kvartira e'lonini suhbatga yubormoqchisiz?</p>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {listings.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleShareListing(l)}
                  className="p-3 rounded-2xl border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 cursor-pointer flex items-center gap-3 transition-all"
                >
                  <img src={l.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 truncate">{l.title}</div>
                    <div className="text-emerald-700 font-black text-xs mt-0.5">{l.price.toLocaleString()} so'm/oy</div>
                    <div className="text-[10px] text-slate-500">{l.region}, {l.district}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleOpenCreateListing}
              className="w-full bg-emerald-600 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Yangi E'lon Joylash</span>
            </button>
          </div>
        </div>
      )}

      {/* Direct Phone Contact Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPhoneModal(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPhoneModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <PhoneCall className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{peerName(currentConv)}</h3>
              <p className="text-xs text-slate-500 mt-1">Maklersiz to'g'ridan-to'g'ri bog'lanish uchun telefon raqami:</p>
            </div>

            <div className="bg-slate-100 p-4 rounded-2xl font-mono font-black text-xl text-slate-900 tracking-wider">
              {currentListing?.owner.phone || "+998 90 123 45 67"}
            </div>

            <a
              href={`tel:${currentListing?.owner.phone || "+998901234567"}`}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Qo'ng'iroq Qilish</span>
            </a>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400 text-sm space-y-3 bg-white rounded-2xl border border-slate-200">
      <MessageSquare className="w-12 h-12 text-slate-300" />
      <p className="font-bold text-slate-600">Suhbatni tanlang yoki yangi e'lon joylang</p>
      <button
        type="button"
        onClick={handleOpenCreateListing}
        className="bg-emerald-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Yangi E'lon Joylash</span>
      </button>
    </div>
  );

  return (
    <div className="md:max-w-6xl md:mx-auto md:px-6 md:py-6">
      <div className="h-[calc(100dvh-3.5rem-4.25rem)] md:h-[calc(100dvh-6rem)] md:min-h-[580px] flex md:gap-4">
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
