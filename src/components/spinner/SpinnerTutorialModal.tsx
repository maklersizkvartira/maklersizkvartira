import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Gift, 
  Coins, 
  CreditCard, 
  TrendingUp, 
  Zap, 
  Trophy, 
  X, 
  ArrowRight, 
  CheckCircle2 
} from 'lucide-react';

interface SpinnerTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSpin: () => void;
}

export const SpinnerTutorialModal: React.FC<SpinnerTutorialModalProps> = ({
  isOpen,
  onClose,
  onStartSpin,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 rounded-3xl border border-amber-500/30 shadow-2xl shadow-amber-500/10 overflow-hidden z-10 my-auto text-white"
        >
          {/* Top Decorative Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-amber-500/20 via-primary-500/10 to-transparent blur-2xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors z-20"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-6 sm:p-8">
            {/* Header / 3D Icon Presentation */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ rotate: -15, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="inline-flex items-center justify-center relative mb-3"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/40">
                  <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                    <span className="text-4xl animate-bounce">🎡</span>
                  </div>
                </div>
                <span className="absolute -top-1 -right-2 flex h-6 w-6">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-6 w-6 bg-amber-500 items-center justify-center text-[10px] font-bold text-slate-950">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                </span>
              </motion.div>

              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                Omad Barabani & Uyiz Coin
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-sm mx-auto">
                Har kuni bepul aylantiring, coinlar yig&apos;ing va ularni haqiqiy pulga yoki e&apos;lon xizmatlariga almashtiring!
              </p>
            </div>

            {/* Steps & Features */}
            <div className="space-y-3.5">
              {/* Feature 1 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white text-sm">
                      Har 24 soatda 1 ta BEPUL imkoniyat
                    </h3>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Bepul
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Har kuni saytga kiring va barabanni bepul aylantirib <span className="text-amber-300 font-bold">50 dan 2,500 gacha</span> Uyiz Coin yutib oling.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Haqiqiy Uzcard / Humo kartaga pul yechish
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Yig&apos;ilgan coinlarni <span className="text-emerald-400 font-bold">1 000 so&apos;mdan 10 000 so&apos;mgacha</span> Uzcard yoki Humo kartangizga to&apos;g&apos;ridan-to&apos;g&apos;ri yechib olishingiz mumkin. Qo&apos;llab-quvvatlash xizmati adminlari tezda to&apos;lab beradi!
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    E&apos;lonlarni TOP va VIP qilish yoki balans
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Coinlarni o&apos;z sayt balansingizga o&apos;tkazing yoki o&apos;zingizning e&apos;lonlaringizni 7 kunga VIP / TOP ga chiqarib xaridorlar oqimini oshiring.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-yellow-500/30 transition-all">
                <div className="p-2.5 rounded-xl bg-yellow-500/20 text-yellow-400 shrink-0 mt-0.5">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Foydalanuvchilar o&apos;rtasida Reyting musobaqasi
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Barcha foydalanuvchilar o&apos;rtasida kim eng ko&apos;p coin yig&apos;ayotganini jonli reytingda kuzating va yetakchilar safiga chiqing!
                  </p>
                </div>
              </div>
            </div>

            {/* Extra note on paid spins */}
            <div className="mt-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-200">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Bepul imkoniyat tugagan taqdirda, sayt balansidagi 1 000 so&apos;m evaziga yana 2 ta aylantirish olishingiz mumkin.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onStartSpin}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-bold text-base shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>Barabanni aylantirish</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
