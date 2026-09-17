import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Sparkles, X, Move } from 'lucide-react';
import { fetchSpinnerStatus, type SpinnerStatus } from '../../services/spinnerApi';
import { useAppStore } from '../../stores/useAppStore';
import { FortuneWheelModal } from './FortuneWheelModal';
import { SpinnerTutorialModal } from './SpinnerTutorialModal';
import { FortuneWheel3DIcon } from './FortuneWheel3DIcon';

const TUTORIAL_STORAGE_KEY = 'uyiz_spinner_tutorial_seen_v1';

// Preset "safe dock points" around the screen edges where it rests like a bird
// Never overlapping with bottom-right AI mascot (which sits at bottom: 16px, right: 16px)
const ROAMING_POSITIONS = [
  { side: 'right', yPercent: 42, label: 'Right Center' },
  { side: 'left', yPercent: 48, label: 'Left Center' },
  { side: 'right', yPercent: 28, label: 'Right Upper' },
  { side: 'left', yPercent: 32, label: 'Left Upper' },
  { side: 'right', yPercent: 62, label: 'Right Lower-Mid' },
];

export const SpinnerWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [status, setStatus] = useState<SpinnerStatus | null>(null);
  const [isGameOpen, setIsGameOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);

  // Bird-like gliding states
  const [positionIndex, setPositionIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isUserDragged, setIsUserDragged] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

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

  // Gentle bird-like wandering timer: rests for 14 seconds, then glides to another edge
  useEffect(() => {
    if (isHovered || isUserDragged || isMinimized || isGameOpen) return;

    const interval = setInterval(() => {
      setPositionIndex((prev) => (prev + 1) % ROAMING_POSITIONS.length);
    }, 15000); // 15 seconds rest at each spot

    return () => clearInterval(interval);
  }, [isHovered, isUserDragged, isMinimized, isGameOpen]);

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

  const currentPos = ROAMING_POSITIONS[positionIndex];

  // Dynamic coordinates based on current roaming spot (if not manually dragged)
  const stylePos: React.CSSProperties = isUserDragged
    ? {}
    : {
        top: `${currentPos.yPercent}%`,
        left: currentPos.side === 'left' ? '18px' : undefined,
        right: currentPos.side === 'right' ? '18px' : undefined,
      };

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        onDragStart={() => setIsUserDragged(true)}
        style={stylePos}
        animate={
          isUserDragged
            ? {}
            : {
                y: isHovered ? 0 : [0, -7, 2, -5, 0],
                rotate: isHovered ? 0 : currentPos.side === 'left' ? [0, 2, -2, 0] : [0, -2, 2, 0],
              }
        }
        transition={{
          y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
          layout: { duration: 1.8, ease: [0.25, 1, 0.5, 1] },
        }}
        layout
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed z-40 touch-none select-none cursor-grab active:cursor-grabbing ${className}`}
        aria-label="Omad Barabani Vidjeti"
      >
        {isMinimized ? (
          // Minimized dock on edge
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-400/50 shadow-lg text-amber-300 text-xs font-bold"
            title="Omad Barabanini ochish"
          >
            <FortuneWheel3DIcon size={22} isSpinning={false} />
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-200">
              Omad
            </span>
          </motion.button>
        ) : (
          <div className="relative group">
            {/* Subtle feather-like floating aura */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-orange-500/30 blur-xl opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none animate-pulse" />

            {/* Main Interactive Capsule */}
            <motion.div
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleOpen}
              className="relative flex items-center gap-2 p-1.5 pr-3.5 rounded-full bg-slate-950/85 backdrop-blur-xl border-2 border-amber-400/80 shadow-[0_10px_28px_rgba(245,158,11,0.35)] cursor-pointer overflow-visible transition-colors group-hover:border-amber-300 group-hover:bg-slate-900/90"
            >
              {/* 3D Fortune Wheel Icon */}
              <div className="relative">
                <FortuneWheel3DIcon
                  size={46}
                  isSpinning={isHovered}
                  className="transition-transform duration-500 group-hover:rotate-45"
                />

                {/* Free or Paid Badge */}
                {canFree ? (
                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-md border border-emerald-100 animate-bounce">
                    Bepul
                  </span>
                ) : hasPaid ? (
                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black tracking-wider shadow-md border border-amber-100">
                    +{status?.paidSpinsAvailable}
                  </span>
                ) : null}
              </div>

              {/* Title & Micro Coin Prompt */}
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 drop-shadow-sm">
                    Omad Barabani
                  </span>
                  <Sparkles className="w-3 h-3 text-amber-300 animate-spin-slow" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300 group-hover:text-amber-200 transition-colors">
                  {canFree ? '1 ta bepul aylantiring' : 'Tangalar yuting'}
                </span>
              </div>

              {/* Subtle close / minimize icon on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(true);
                }}
                className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 rounded-full text-slate-400 hover:text-white transition-opacity ml-1"
                title="Kichraytirish"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>

            {/* Helper tooltip on hover: "Erkin suzuvchi, hohlagan joyingizga surishingiz mumkin" */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute left-1/2 -translate-x-1/2 -bottom-7 whitespace-nowrap px-2.5 py-1 rounded-md bg-slate-900/95 border border-amber-500/40 text-[10px] text-amber-200 shadow-xl pointer-events-none flex items-center gap-1.5"
                >
                  <Move className="w-2.5 h-2.5 opacity-60" />
                  <span>Surib qo&apos;yish mumkin</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

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
