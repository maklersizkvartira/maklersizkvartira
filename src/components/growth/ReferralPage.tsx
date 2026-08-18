import React, { useState } from 'react';
import { 
  Award, Share2, Copy, Users, Sparkles, CheckCircle2, 
  Crown, Gift, Trophy, ExternalLink, Zap 
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const ReferralPage: React.FC = () => {
  const { userXp, addXp, setAiMascotMessage } = useAppStore();
  const [copied, setCopied] = useState(false);

  const referralCode = 'ZAYN123';
  const referralLink = `https://maklersizuy.uz/r/${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    addXp(30, "Do'stlarga havola ulashildi");
    setTimeout(() => setCopied(false), 2000);
  };

  const rewards = [
    { count: 1, title: 'Trust XP Bonus', desc: '+30 XP har bir do\'st uchun', unlocked: true },
    { count: 3, title: 'Referral Badge', desc: 'Profilda belgi', unlocked: true },
    { count: 5, title: 'Premium Search Access', desc: '1 oy bepul', unlocked: false },
    { count: 10, title: 'Free Listing Boost', desc: 'E\'lonni yuqoriga chiqarish', unlocked: false },
    { count: 25, title: 'VIP Member Status', desc: 'VIP nishon va ustunlik', unlocked: false },
    { count: 50, title: 'Campus Ambassador', desc: 'Universitet elchisi statusi', unlocked: false },
  ];

  const leaderboard = [
    { rank: 1, name: 'Jasur Karimov', referrals: 18, xp: 1450, badge: 'Diamond Ambassador' },
    { rank: 2, name: 'Nodira Alimova', referrals: 12, xp: 980, badge: 'Gold Referrer' },
    { rank: 3, name: 'Sardorbek Valiyev', referrals: 9, xp: 750, badge: 'Silver Referrer' },
    { rank: 4, name: 'Siz (You)', referrals: 4, xp: userXp, badge: 'Bronze Referrer' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 min-h-[85vh] space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white p-6 sm:p-10 rounded-3xl shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-3 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-950 px-3.5 py-1 rounded-full border border-emerald-500/40">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> Viral Growth Engine & Referral
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Do'stlaringizni Taklif Qiling va Mukofot Oling!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
            Har bir taklif qilingan do'stingiz uchun sizga +30 Trust XP beriladi hamda Premium imkoniyatlar ochiladi.
          </p>
        </div>

        {/* User Code Box */}
        <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/20 text-center w-full md:w-80 space-y-3 shrink-0">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Sizning Taklif Kodingiz</span>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-widest bg-slate-950/60 py-2 rounded-xl border border-amber-400/30">
            {referralCode}
          </div>

          <button
            onClick={handleCopy}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Havola Ko\'chirildi!' : 'Referral Havolani Ko\'chirish'}</span>
          </button>
        </div>
      </div>

      {/* Rewards Milestones & Unlocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-600" /> Taklif Mukofotlari Qatori
          </h2>
          <span className="text-xs text-slate-500 font-medium">Jami takliflar: 4 ta do'st</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {rewards.map((reward, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                reward.unlocked
                  ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
                  {reward.count} ta do'st
                </span>
                {reward.unlocked ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ochilgan
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">Qulflangan</span>
                )}
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">{reward.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{reward.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Top Referrers Reytingi (Leaderboard)
          </h2>
          <span className="text-xs text-slate-400 font-medium">Haftalik yangilanadi</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {leaderboard.map((user) => (
            <div key={user.rank} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  user.rank === 1 ? 'bg-amber-400 text-slate-900' :
                  user.rank === 2 ? 'bg-slate-300 text-slate-900' :
                  user.rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  #{user.rank}
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">{user.name}</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">{user.badge}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-slate-900 block">{user.referrals} ta taklif</span>
                <span className="text-[10px] text-amber-600 font-mono font-bold">{user.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
