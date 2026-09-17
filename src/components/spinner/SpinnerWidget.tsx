import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { fetchSpinnerStatus, type SpinnerStatus } from '../../services/spinnerApi';
import { useAppStore } from '../../stores/useAppStore';
import { FortuneWheelModal } from './FortuneWheelModal';
import { SpinnerTutorialModal } from './SpinnerTutorialModal';
import { FortuneWheel3DIcon } from './FortuneWheel3DIcon';

const TUTORIAL_STORAGE_KEY = 'uyiz_spinner_tutorial_seen_v1';

export const SpinnerWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [status, setStatus] = useState<SpinnerStatus | null>(null);
  const [isGameOpen, setIsGameOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

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

  return (
    <>
      {/* Ekranning o'ng tarafidagi yordamchi suzuvchi 3D Omad Barabani */}
      <div
        className={`fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-40 select-none ${className}`}
      >
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.92 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleOpen}
          className="relative group p-1 sm:p-1.5 rounded-full bg-slate-950/70 backdrop-blur-md border border-amber-400/60 shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center justify-center cursor-pointer transition-shadow hover:shadow-[0_12px_40px_rgba(245,158,11,0.65)] hover:border-amber-300"
          aria-label="Omad Barabani"
          title="Omad Barabani — Bepul aylantirib tangalar yuting!"
        >
          {/* Ambient Rotating Gold Glow Aura */}
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-500/40 via-yellow-400/30 to-orange-500/40 blur-md opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none animate-pulse" />

          {/* 3D Chirpirak Aylanuvchi Baraban Ikonkasi (Hech qanday xalaqit beruvchi yozuvsiz) */}
          <div className="relative z-10">
            <FortuneWheel3DIcon
              size={54}
              isHovered={isHovered}
              className="drop-shadow-lg"
            />
          </div>

          {/* Bepul yoki pullik aylantirish indikatori (ixcham nishon) */}
          {canFree ? (
            <span className="absolute -top-1.5 -right-1 z-20 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-lg border border-emerald-100 animate-bounce">
              Bepul
            </span>
          ) : hasPaid ? (
            <span className="absolute -top-1.5 -right-1 z-20 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black tracking-wider shadow-lg border border-amber-100">
              +{status?.paidSpinsAvailable}
            </span>
          ) : null}

          {/* Hover qilganda nozik yordamchi popup tooltip */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                className="absolute right-full mr-3 whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-amber-400/40 text-amber-200 text-xs font-bold shadow-2xl pointer-events-none flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                <span>Omad Barabani</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Main Game Modals */}
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
