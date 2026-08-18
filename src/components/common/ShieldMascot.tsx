import React, { useState } from 'react';
import { Shield, Sparkles, X, MessageSquare, Send } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { replyAsAssistant } from '../../services/aiEngine';

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

export const ShieldMascot: React.FC = () => {
  const { listings, setCurrentView, setFilters, setSearchQuery, setShowAuth, aiMascotMessage } = useAppStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [usageCount, setUsageCount] = useState<number>(getDailyUsage());
  const [log, setLog] = useState<{ from: 'ai' | 'me'; text: string }[]>([
    { from: 'ai', text: "🤖 Salom! Men Shield AI yordamchisiman. Masalan yozing: «Chilonzordan 3ml ga kvartira kerak» yoki «Yunusobod 2 xona»." },
  ]);

  const send = () => {
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

    const nextUsage = incrementDailyUsage();
    setUsageCount(nextUsage);

    const reply = replyAsAssistant(msg, listings);
    setLog((prev) => [
      ...prev,
      { from: 'me', text: msg },
      { from: 'ai', text: `${reply.text}\n\n(📊 Bugungi AI so'rovlar: ${nextUsage}/${DAILY_LIMIT})` }
    ]);
    setText('');

    if (reply.need) {
      setFilters({
        selectedRegion: reply.need.region || undefined,
        selectedDistrict: reply.need.district || undefined,
        roomsCount: reply.need.rooms ?? undefined,
        maxPrice: reply.need.maxPrice || undefined,
        audience: reply.need.audience || undefined,
        selectedMetro: reply.need.nearMetro ? undefined : undefined,
        sortBy: 'AI',
      } as any);
      if (reply.need.query) setSearchQuery(reply.need.query);
    }
    if (reply.go === 'AUTH') setShowAuth(true);
    if (reply.go === 'SEARCH') setCurrentView('SEARCH');
    if (reply.go === 'CREATE_LISTING') setCurrentView('CREATE_LISTING');
    if (reply.go === 'HOME') setCurrentView('HOME');
  };

  return (
    <div className="fixed bottom-[5.75rem] right-3 left-3 z-40 md:left-auto md:bottom-6 md:right-6 max-w-sm md:w-auto ml-auto pb-safe">
      {open ? (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/40">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-semibold text-sm flex items-center gap-1">
                    Shield AI <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </h4>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                    Limit: {usageCount}/{DAILY_LIMIT}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400">Kuniga 3 ta bepul AI so'rov</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2 mb-3 pr-1">
            {aiMascotMessage && (
              <p className="text-xs text-emerald-200 bg-emerald-950/50 rounded-xl p-2">{aiMascotMessage}</p>
            )}
            {log.map((m, i) => (
              <p key={i} className={`text-xs leading-relaxed whitespace-pre-line rounded-xl p-2 ${m.from === 'me' ? 'bg-emerald-700/40 text-white ml-6' : 'bg-slate-800 text-slate-200 mr-4'}`}>
                {m.text}
              </p>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="2 xonali Yunusobod..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
            />
            <button type="submit" className="bg-emerald-600 rounded-xl px-3">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 bg-slate-900 text-white px-3.5 py-2.5 rounded-full shadow-xl border border-emerald-500/50"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold hidden sm:inline">Shield AI Yordamchi</span>
          <MessageSquare className="w-4 h-4 text-emerald-400" />
        </button>
      )}
    </div>
  );
};
