import React, { useState } from 'react';
import { Shield, Sparkles, X, MessageSquare, Send } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { API_BASE_URL } from '../../services/apiService';

const DAILY_LIMIT = 3;

function getDailyUsage(): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `shield-ai-usage-${today}`;
    const val = localStorage.getItem(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

function incrementDailyUsage(): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `shield-ai-usage-${today}`;
    const current = getDailyUsage();
    const next = current + 1;
    localStorage.setItem(key, next.toString());
    return next;
  } catch {
    return 1;
  }
}

function resetDailyUsage(): void {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `shield-ai-usage-${today}`;
    localStorage.removeItem(key);
  } catch {}
}

export const ShieldMascot: React.FC = () => {
  const { listings, setCurrentView, setFilters, setSearchQuery, setShowAuth, aiMascotMessage } = useAppStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [usageCount, setUsageCount] = useState<number>(getDailyUsage());
  const isLimitReached = usageCount >= DAILY_LIMIT;
  const [log, setLog] = useState<{ from: 'ai' | 'me'; text: string }[]>([
    { from: 'ai', text: "🤖 Salom! Men Shield AI yordamchisiman. Masalan yozing: «Chilonzordan 3 mlnga kvartira kerak» yoki «Yunusobod 2 xona»." },
  ]);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;

    const current = getDailyUsage();
    if (current >= DAILY_LIMIT) {
      setLog((prev) => [
        ...prev,
        { from: 'me', text: msg },
        {
          from: 'ai',
          text: "⚠️ Siz bugungi 3 ta bepul Shield AI so'rov limitidan foydalandingiz. Limitingiz ertaga yana to'ldiriladi! Hozircha Kvartiralar qidiruv sahifasidan bepul foydalanishingiz mumkin."
        }
      ]);
      setText('');
      return;
    }

    setLog((prev) => [...prev, { from: 'me', text: msg }]);
    setText('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await response.json();
      
      const nextUsage = incrementDailyUsage();
      setUsageCount(nextUsage);

      if (data.status === 'success') {
        setLog((prev) => [
          ...prev,
          { from: 'ai', text: `${data.reply}\n\n(📊 Bugungi AI so'rovlar: ${nextUsage}/${DAILY_LIMIT})` }
        ]);

        if (data.need) {
          setFilters({
            selectedRegion: data.need.region || 'Barchasi',
            selectedDistrict: data.need.district || 'Barchasi',
            roomsCount: data.need.rooms ?? null,
            maxPrice: data.need.maxPrice || 100000000,
            audience: data.need.audience || 'ALL',
            selectedMetro: 'Barchasi',
            sortBy: 'AI',
          } as any);
          if (data.need.district) {
            setSearchQuery(data.need.district);
          }
        }
      } else {
        setLog((prev) => [...prev, { from: 'ai', text: "🤖 Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring." }]);
      }
    } catch (e) {
      setLog((prev) => [...prev, { from: 'ai', text: "🤖 Tarmoq xatosi. Iltimos qaytadan urinib ko'ring." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setLog([{ from: 'ai', text: "🤖 Salom! Men Shield AI yordamchisiman. Masalan yozing: «Chilonzordan 3 mlnga kvartira kerak» yoki «Yunusobod 2 xona»." }]);
  };

  return (
    <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:bottom-6 sm:right-6 z-40 max-w-sm sm:w-96 ml-auto pointer-events-auto">
      {open ? (
        <div className="bg-slate-950 text-white rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-emerald-500/40 flex flex-col max-h-[80vh] sm:max-h-[480px] overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-1">
                    Shield AI <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  </h4>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-black px-2 py-0.5 rounded-full">
                    Limit: {usageCount}/{DAILY_LIMIT}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Aqlli uy qidiruv yordamchisi</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetDailyUsage();
                  setUsageCount(0);
                  setLog((prev) => [...prev, { from: 'ai', text: "🔄 AI so'rovlar limitingiz muvaffaqiyatli nollashtirildi! Cheksiz sinab ko'rishingiz mumkin." }]);
                }}
                className="text-[10px] bg-emerald-950 hover:bg-emerald-900 text-emerald-300 px-2 py-1 rounded-xl border border-emerald-500/40 font-bold transition-all active:scale-95 flex items-center gap-1"
                title="Limitni nollashtirish"
              >
                🔄 Reset
              </button>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Log Area */}
          <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 pr-1 min-h-0 text-xs scrollbar-thin scrollbar-thumb-slate-800">
            {aiMascotMessage && (
              <p className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 leading-relaxed">
                {aiMascotMessage}
              </p>
            )}
            {log.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl leading-relaxed break-words overflow-hidden text-xs ${
                  m.from === 'me'
                    ? 'bg-emerald-600/30 text-white border border-emerald-500/30 ml-6 self-end font-medium'
                    : 'bg-slate-900 text-slate-200 border border-slate-800 mr-3 font-normal'
                }`}
              >
                <div className="whitespace-pre-line break-words">{m.text}</div>
              </div>
            ))}
          </div>

          {/* Form Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 shrink-0 pt-1 border-t border-slate-800/80"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLimitReached || loading}
              placeholder={isLimitReached ? "Bugungi limit tugadi" : loading ? "AI o'ylamoqda..." : "Chilonzordan 3ml ga..."}
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
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 bg-slate-950 text-white px-4 py-3 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.4)] border border-emerald-500/50 hover:border-emerald-400 transition-all active:scale-95 ml-auto"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/40">
            <Shield className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-white flex items-center gap-1">
              Shield AI <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">Aqlli Yordamchi</span>
          </div>
          <MessageSquare className="w-4 h-4 text-emerald-400 ml-1" />
        </button>
      )}
    </div>
  );
};
