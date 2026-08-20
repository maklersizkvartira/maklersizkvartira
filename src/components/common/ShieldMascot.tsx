import React, { useState, useEffect, useRef } from 'react';
import { Shield, Sparkles, X, MessageSquare, Send, RotateCcw, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { API_BASE_URL } from '../../services/apiService';
import { getAccessToken } from '../../services/authService';

// ─── Session key: only a tiny ID in localStorage. All DATA is in backend DB ──
const SESSION_KEY_STORAGE = 'shield-ai-sk';

function getOrCreateSessionKey(): string {
  let key = localStorage.getItem(SESSION_KEY_STORAGE);
  if (!key) {
    key = 'sk-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
    localStorage.setItem(SESSION_KEY_STORAGE, key);
  }
  return key;
}

interface ChatMsg {
  from: 'ai' | 'me';
  text: string;
}

export const ShieldMascot: React.FC = () => {
  const { setFilters, setSearchQuery, setCurrentView, currentUser } = useAppStore();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [log, setLog] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Quota from backend — no localStorage
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState(10);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLimitReached = remaining !== null && remaining <= 0;

  const WELCOME_MSG =
    'Salom! Men Shield AI yordamchisiman 🛡️\n\nMasalan yozing:\n• «Chilonzordan 3 mlnga kvartira kerak»\n• «Yunusobod 2 xona talaba uchun»\n• «Sherikchilik bilan xona izlayapman»';

  // ── Load history + quota from backend on first open ────────────────────────
  useEffect(() => {
    if (!open || historyLoaded) return;

    const sessionKey = getOrCreateSessionKey();
    fetch(`${API_BASE_URL}/smart/assistant/history?sessionKey=${encodeURIComponent(sessionKey)}`)
      .then(r => r.json())
      .then(data => {
        // Restore messages from DB
        if (data.messages && data.messages.length > 0) {
          const restored: ChatMsg[] = data.messages.map((m: any) => ({
            from: m.role === 'user' ? 'me' : 'ai',
            text: m.content,
          }));
          setLog(restored);
        } else {
          const welcome = currentUser?.name
            ? `Salom, ${currentUser.name}! Men Shield AI yordamchisiman 🛡️\n\nQanday kvartira yoki xona izlayapsiz?`
            : WELCOME_MSG;
          setLog([{ from: 'ai', text: welcome }]);
        }
        // Quota from backend
        if (typeof data.remaining === 'number') setRemaining(data.remaining);
        if (typeof data.limit === 'number') setDailyLimit(data.limit);
        setHistoryLoaded(true);
      })
      .catch(() => {
        setLog([{ from: 'ai', text: WELCOME_MSG }]);
        setHistoryLoaded(true);
      });
  }, [open, historyLoaded, currentUser]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, loading]);

  // ── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // ─── Send message (backend handles rate limiting) ────────────────────────
  const send = async () => {
    const msg = text.trim();
    if (!msg || loading) return;

    setLog(prev => [...prev, { from: 'me', text: msg }]);
    setText('');
    setLoading(true);

    try {
      const sessionKey = getOrCreateSessionKey();
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/smart/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: msg,
          sessionKey,
          userName: currentUser?.name || null,
          userPhone: currentUser?.phone || null,
        }),
      });
      const data = await response.json();

      // Update quota from backend response (single source of truth)
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (typeof data.limit === 'number') setDailyLimit(data.limit);

      if (data.status === 'limit_reached') {
        setLog(prev => [...prev, { from: 'ai', text: data.reply }]);
        return;
      }

      if (data.status === 'success') {
        // Show remaining note if low
        const rem = typeof data.remaining === 'number' ? data.remaining : null;
        const note = rem !== null && rem <= 2 && rem > 0
          ? `\n\n(⚠️ ${rem} ta so'rov qoldi)`
          : rem === 0 ? '\n\n(⚠️ Bugungi limit tugadi)' : '';
        setLog(prev => [...prev, { from: 'ai', text: data.reply + note }]);

        // Apply search filters from AI
        if (data.need) {
          setFilters({
            selectedRegion: data.need.region || 'Barchasi',
            selectedDistrict: data.need.district || 'Barchasi',
            roomsCount: data.need.rooms ?? null,
            maxPrice: data.need.maxPrice || 100000000,
            audience: data.need.audience || 'ALL',
            rentalType: data.need.rentalType || 'ALL',
            selectedMetro: 'Barchasi',
            sortBy: 'AI',
          } as any);
          if (data.need.district) setSearchQuery(data.need.district);
        }
      } else {
        setLog(prev => [...prev, { from: 'ai', text: "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring." }]);
      }
    } catch {
      setLog(prev => [...prev, { from: 'ai', text: 'Tarmoq xatosi. Internet aloqangizni tekshiring.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    // Remove session key so a new session starts
    localStorage.removeItem(SESSION_KEY_STORAGE);
    setHistoryLoaded(false);
    setRemaining(null);
    setLog([{ from: 'ai', text: WELCOME_MSG }]);
  };

  return (
    <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-40 max-w-sm sm:w-96 ml-auto pointer-events-auto">
      {open ? (
        <div className="bg-slate-950 text-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-emerald-500/40 flex flex-col max-h-[82vh] sm:max-h-[520px] overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-slate-800/80 p-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1">
                    Shield AI <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  </h4>
                  {remaining !== null && (
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                      remaining <= 2
                        ? 'bg-red-950 text-red-400 border-red-500/30'
                        : 'bg-emerald-950 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {remaining}/{dailyLimit} qoldi
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">Aqlli uy qidiruv yordamchisi</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
                title="Suhbatni tozalash"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div className="flex-1 overflow-y-auto space-y-2.5 p-4 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
            {/* Loading history indicator */}
            {!historyLoaded && (
              <div className="flex justify-center py-8">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {log.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                {m.from === 'ai' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mr-2 mt-0.5">
                    <Shield className="w-3 h-3" />
                  </div>
                )}
                <div className={`max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed break-words ${
                  m.from === 'me'
                    ? 'bg-emerald-600/30 text-white border border-emerald-500/30 rounded-tr-sm font-medium'
                    : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-sm'
                }`}>
                  <div className="whitespace-pre-line break-words">{m.text}</div>
                </div>
              </div>
            ))}

            {/* AI thinking animation */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mr-2 mt-0.5">
                  <Shield className="w-3 h-3 animate-pulse" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {/* Go to search button after results */}
            {log.length > 1 && !loading && (
              <button
                onClick={() => { setCurrentView('SEARCH'); setOpen(false); }}
                className="w-full text-xs bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 py-2.5 px-4 rounded-2xl transition flex items-center justify-center gap-1.5 font-medium"
              >
                Barcha kvartiralarni ko'rish
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <div ref={logEndRef} />
          </div>

          {/* ── Input ── */}
          <form
            onSubmit={e => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 p-3 shrink-0 border-t border-slate-800/80"
          >
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={isLimitReached || loading}
              placeholder={
                isLimitReached ? 'Bugungi limit tugadi'
                : loading ? "Shield AI o'ylamoqda..."
                : 'Chilonzordan 3 mlnga...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={isLimitReached || !text.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl p-2.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        /* ── Floating trigger ── */
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.4)] border border-emerald-500/50 hover:border-emerald-400 hover:shadow-[0_10px_40px_rgba(16,185,129,0.2)] transition-all active:scale-95 ml-auto"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/40 group-hover:scale-110 transition-transform">
            <Shield className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-white flex items-center gap-1">
              Shield AI <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Aqlli Yordamchi</span>
          </div>
          <MessageSquare className="w-4 h-4 text-emerald-400 ml-1 group-hover:animate-bounce" />
        </button>
      )}
    </div>
  );
};
