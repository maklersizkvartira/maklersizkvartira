import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { fetchSpinnerStatus, type SpinnerStatus } from '../../services/spinnerApi';
import { useAppStore } from '../../stores/useAppStore';
import { FortuneWheelModal } from './FortuneWheelModal';
import { SpinnerTutorialModal } from './SpinnerTutorialModal';

interface SpinnerWidgetProps {
  variant?: 'floating' | 'header';
  className?: string;
}

const TUTORIAL_STORAGE_KEY = 'uyiz_spinner_tutorial_seen_v1';

export const SpinnerWidget: React.FC<SpinnerWidgetProps> = ({
  variant = 'floating',
  className = '',
}) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [status, setStatus] = useState<SpinnerStatus | null>(null);
  const [isGameOpen, setIsGameOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    fetchSpinnerStatus()
      .then((data) => {
        if (mounted) setStatus(data);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [currentUser]);

  const handleOpen = () => {
    const hasSeenTutorial = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!hasSeenTutorial) {
      setIsTutorialOpen(true);
    } else {
      setIsGameOpen(true);
    }
  };

  const handleStartFromTutorial = () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    setIsTutorialOpen(false);
    setIsGameOpen(true);
  };

  const handleOpenTutorialFromGame = () => {
    setIsTutorialOpen(true);
  };

  const canFree = status?.canFreeSpin ?? true;
  const hasPaid = (status?.paidSpinsAvailable ?? 0) > 0;

  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleOpen}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-amber-500/10 hover:from-amber-500/20 hover:to-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold text-xs shadow-sm transition-all hover:scale-105 active:scale-95 group ${className}`}
          title="Omad Barabani & Uyiz Coin"
        >
          <span className="text-base group-hover:rotate-45 transition-transform duration-300">
            🎡
          </span>
          <span className="hidden sm:inline font-bold">Omad Barabani</span>

          {canFree && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}

          {canFree && (
            <span className="hidden md:inline text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Bepul
            </span>
          )}
        </button>

        <FortuneWheelModal
          isOpen={isGameOpen}
          onClose={() => setIsGameOpen(false)}
          onOpenTutorial={handleOpenTutorialFromGame}
        />

        <SpinnerTutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
          onStartSpin={handleStartFromTutorial}
        />
      </>
    );
  }

  // Floating button (stacked above AI mascot)
  return (
    <>
      <div className={`fixed bottom-36 right-4 sm:bottom-20 sm:right-6 z-40 ${className}`}>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleOpen}
          className="relative group p-3 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400 shadow-2xl shadow-amber-500/30 flex items-center justify-center cursor-pointer overflow-visible"
          aria-label="Omad Barabani"
        >
          {/* Ambient Glow */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-500/40 via-yellow-400/40 to-orange-500/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity animate-pulse pointer-events-none" />

          {/* Icon Content */}
          <div className="relative z-10 flex flex-col items-center">
            <span className="text-2xl sm:text-3xl filter drop-shadow-md group-hover:rotate-180 transition-transform duration-700 ease-out">
              🎡
            </span>
            <span className="text-[9px] font-black uppercase text-amber-300 tracking-wider -mt-0.5">
              Omad
            </span>
          </div>

          {/* Badge: BEPUL or count */}
          {canFree ? (
            <span className="absolute -top-2 -right-2 z-20 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg border border-emerald-200 animate-bounce">
              Bepul
            </span>
          ) : hasPaid ? (
            <span className="absolute -top-2 -right-2 z-20 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black tracking-wider shadow-lg border border-amber-200">
              +{status?.paidSpinsAvailable}
            </span>
          ) : null}
        </motion.button>
      </div>

      <FortuneWheelModal
        isOpen={isGameOpen}
        onClose={() => setIsGameOpen(false)}
        onOpenTutorial={handleOpenTutorialFromGame}
      />

      <SpinnerTutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onStartSpin={handleStartFromTutorial}
      />
    </>
  );
};
