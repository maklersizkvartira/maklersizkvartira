'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Trophy,
  Bot,
  Flame,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Building2,
  Palette,
  Play,
  Pause,
  Award,
} from 'lucide-react';
import { sound } from './sound';
import { getAiRecommendation, AiEvaluation } from './ai-solver';
import { Direction, GameTheme, TileData, Achievement } from './types';

// Real Estate theme mapping
interface TileMetadata {
  label: string;
  sub: string;
  icon: string;
  color: string;
  textColor: string;
  glow?: string;
}

const UYIZ_TILES: Record<number, TileMetadata> = {
  2: { label: 'Kulba', sub: 'Chayla', icon: '🏕️', color: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', textColor: '#0369a1' },
  4: { label: 'Xona', sub: '1 xona', icon: '🛖', color: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', textColor: '#3730a3' },
  8: { label: 'Kvartira', sub: '2 xonali', icon: '🏠', color: 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)', textColor: '#9a3412' },
  16: { label: 'Hovli', sub: 'Uy-joy', icon: '🏡', color: 'linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)', textColor: '#831843' },
  32: { label: 'Kottej', sub: 'Zamonaviy', icon: '🏘️', color: 'linear-gradient(135deg, #fecdd3 0%, #fb7185 100%)', textColor: '#881337' },
  64: { label: 'Villa', sub: 'Premium', icon: '🏰', color: 'linear-gradient(135deg, #fef08a 0%, #eab308 100%)', textColor: '#713f12', glow: '0 0 16px rgba(234, 179, 8, 0.4)' },
  128: { label: 'Penthouse', sub: 'Hashamatli', icon: '🏬', color: 'linear-gradient(135deg, #a7f3d0 0%, #34d399 100%)', textColor: '#064e3b', glow: '0 0 18px rgba(52, 211, 153, 0.4)' },
  256: { label: 'Majmua', sub: 'Turar-joy', icon: '🏙️', color: 'linear-gradient(135deg, #6ee7b7 0%, #059669 100%)', textColor: '#ffffff', glow: '0 0 20px rgba(5, 150, 105, 0.5)' },
  512: { label: 'Plaza', sub: 'Biznes Markaz', icon: '🌆', color: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', textColor: '#ffffff', glow: '0 0 22px rgba(2, 132, 199, 0.5)' },
  1024: { label: 'Osmono‘par', sub: 'Skyscraper', icon: '🏢', color: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)', textColor: '#ffffff', glow: '0 0 25px rgba(79, 70, 229, 0.6)' },
  2048: { label: 'Uyiz Imperiyasi', sub: 'Mega Magnat', icon: '👑', color: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', textColor: '#ffffff', glow: '0 0 32px rgba(217, 119, 6, 0.8)' },
  4096: { label: 'Uyiz Afsonasi', sub: 'Metropolis', icon: '💎', color: 'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)', textColor: '#ffffff', glow: '0 0 35px rgba(147, 51, 234, 0.8)' },
};

const CLASSIC_TILES: Record<number, { color: string; textColor: string; glow?: string }> = {
  2: { color: '#eee4da', textColor: '#776e65' },
  4: { color: '#ede0c8', textColor: '#776e65' },
  8: { color: '#f2b179', textColor: '#f9f6f2' },
  16: { color: '#f59563', textColor: '#f9f6f2' },
  32: { color: '#f67c5f', textColor: '#f9f6f2' },
  64: { color: '#f65e3b', textColor: '#f9f6f2' },
  128: { color: '#edcf72', textColor: '#f9f6f2', glow: '0 0 15px rgba(237, 207, 114, 0.5)' },
  256: { color: '#edcc61', textColor: '#f9f6f2', glow: '0 0 18px rgba(237, 204, 97, 0.6)' },
  512: { color: '#edc850', textColor: '#f9f6f2', glow: '0 0 20px rgba(237, 200, 80, 0.7)' },
  1024: { color: '#edc53f', textColor: '#f9f6f2', glow: '0 0 24px rgba(237, 197, 63, 0.8)' },
  2048: { color: '#edc22e', textColor: '#f9f6f2', glow: '0 0 30px rgba(237, 194, 46, 0.9)' },
  4096: { color: '#3c3a32', textColor: '#f9f6f2', glow: '0 0 30px rgba(60, 58, 50, 0.9)' },
};

const CYBERPUNK_TILES: Record<number, { color: string; textColor: string; glow?: string }> = {
  2: { color: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', textColor: '#38bdf8', glow: '0 0 10px rgba(56, 189, 248, 0.3)' },
  4: { color: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)', textColor: '#34d399', glow: '0 0 12px rgba(52, 211, 153, 0.4)' },
  8: { color: 'linear-gradient(135deg, #3b0764 0%, #581c87 100%)', textColor: '#c084fc', glow: '0 0 14px rgba(192, 132, 252, 0.4)' },
  16: { color: 'linear-gradient(135deg, #701a75 0%, #86198f 100%)', textColor: '#f472b6', glow: '0 0 16px rgba(244, 114, 182, 0.5)' },
  32: { color: 'linear-gradient(135deg, #831843 0%, #9d174d 100%)', textColor: '#fb7185', glow: '0 0 18px rgba(251, 113, 133, 0.6)' },
  64: { color: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)', textColor: '#fb923c', glow: '0 0 20px rgba(251, 146, 60, 0.6)' },
  128: { color: 'linear-gradient(135deg, #713f12 0%, #854d0e 100%)', textColor: '#facc15', glow: '0 0 22px rgba(250, 204, 21, 0.7)' },
  256: { color: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', textColor: '#2dd4bf', glow: '0 0 24px rgba(45, 212, 191, 0.8)' },
  512: { color: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', textColor: '#38bdf8', glow: '0 0 26px rgba(56, 189, 248, 0.8)' },
  1024: { color: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', textColor: '#a5b4fc', glow: '0 0 30px rgba(165, 180, 252, 0.9)' },
  2048: { color: 'linear-gradient(135deg, #be185d 0%, #e11d48 100%)', textColor: '#ffe4e6', glow: '0 0 35px rgba(244, 63, 94, 1)' },
  4096: { color: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)', textColor: '#fdf4ff', glow: '0 0 40px rgba(192, 38, 211, 1)' },
};

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_64', title: 'Birinchi Kottej', description: '64 lik blokni birlashtirish', icon: '🏘️', unlocked: false },
  { id: 'mighty_256', title: 'Katta Majmua', description: '256 lik binoga erishish', icon: '🏢', unlocked: false },
  { id: 'magnate_1024', title: 'Uyiz Magnati', description: '1024 osmono‘par bino qurish', icon: '🌆', unlocked: false },
  { id: 'empire_2048', title: 'Uyiz Imperiyasi', description: '2048 yutuqli blokni zabt etish!', icon: '👑', unlocked: false },
  { id: 'combo_master', title: 'Kombinator', description: 'Bir harakatda 3+ ta birlashish', icon: '⚡', unlocked: false },
  { id: 'score_5k', title: 'Katta Daromad', description: '5,000 dan ortiq ball to‘plash', icon: '💰', unlocked: false },
];

export function Game2048() {
  const [board, setBoard] = useState<number[][]>(() => [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);

  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [undos, setUndos] = useState(3);
  const [history, setHistory] = useState<{ board: number[][]; score: number }[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [dismissWon, setDismissWon] = useState(false);
  const [theme, setTheme] = useState<GameTheme>('uyiz');
  const [muted, setMuted] = useState(false);
  const [combo, setCombo] = useState<{ text: string; id: number } | null>(null);
  const [floatingScore, setFloatingScore] = useState<{ points: number; id: number } | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AiEvaluation | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [showAchievements, setShowAchievements] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and load saved state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBest = localStorage.getItem('uyiz_2048_best');
      if (savedBest) setBestScore(Number(savedBest));

      const savedTheme = localStorage.getItem('uyiz_2048_theme') as GameTheme;
      if (savedTheme) setTheme(savedTheme);

      const savedAchievements = localStorage.getItem('uyiz_2048_achievements');
      if (savedAchievements) {
        try {
          setAchievements(JSON.parse(savedAchievements));
        } catch {
          // ignore
        }
      }
      setMuted(sound.isMuted());
    }
  }, []);

  // Check achievements
  const checkAchievements = useCallback((currentScore: number, maxTile: number, comboCount: number) => {
    setAchievements((prev) => {
      let updated = false;
      const next = prev.map((a) => {
        if (a.unlocked) return a;
        let shouldUnlock = false;
        if (a.id === 'first_64' && maxTile >= 64) shouldUnlock = true;
        if (a.id === 'mighty_256' && maxTile >= 256) shouldUnlock = true;
        if (a.id === 'magnate_1024' && maxTile >= 1024) shouldUnlock = true;
        if (a.id === 'empire_2048' && maxTile >= 2048) shouldUnlock = true;
        if (a.id === 'combo_master' && comboCount >= 3) shouldUnlock = true;
        if (a.id === 'score_5k' && currentScore >= 5000) shouldUnlock = true;

        if (shouldUnlock) {
          updated = true;
          sound.playCombo(3);
          return { ...a, unlocked: true, unlockedAt: Date.now() };
        }
        return a;
      });

      if (updated && typeof window !== 'undefined') {
        localStorage.setItem('uyiz_2048_achievements', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  // Spawn tile in random empty slot
  const spawnRandomTile = useCallback((b: number[][]): number[][] => {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === 0) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return b;

    const chosen = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const val = Math.random() < 0.9 ? 2 : 4;

    const next = b.map((row) => [...row]);
    next[chosen.r][chosen.c] = val;
    return next;
  }, []);

  // Reset Game
  const resetGame = useCallback(() => {
    let fresh = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    fresh = spawnRandomTile(fresh);
    fresh = spawnRandomTile(fresh);

    setBoard(fresh);
    setScore(0);
    setMoves(0);
    setUndos(3);
    setHistory([]);
    setGameOver(false);
    setHasWon(false);
    setDismissWon(false);
    setAiAdvice(null);
    setAutoPlay(false);
    sound.playMove();
  }, [spawnRandomTile]);

  // Initial spawn on mount
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Check game over
  const checkGameOver = useCallback((b: number[][]): boolean => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === 0) return false;
        if (c + 1 < 4 && b[r][c] === b[r][c + 1]) return false;
        if (r + 1 < 4 && b[r][c] === b[r + 1][c]) return false;
      }
    }
    return true;
  }, []);

  // Move Logic
  const move = useCallback(
    (direction: Direction) => {
      if (gameOver) return;

      const rotate = (b: number[][]) => {
        const N = 4;
        const res = Array.from({ length: N }, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            res[c][N - 1 - r] = b[r][c];
          }
        }
        return res;
      };

      let working = board.map((row) => [...row]);
      let rotations = 0;
      if (direction === 'UP') rotations = 3;
      else if (direction === 'RIGHT') rotations = 2;
      else if (direction === 'DOWN') rotations = 1;

      for (let i = 0; i < rotations; i++) {
        working = rotate(working);
      }

      let scoreGain = 0;
      let mergeCount = 0;
      let maxMerged = 0;
      let moved = false;

      // Slide and merge left
      for (let r = 0; r < 4; r++) {
        const row = working[r].filter((v) => v !== 0);
        const newRow: number[] = [];
        let skip = false;

        for (let c = 0; c < row.length; c++) {
          if (skip) {
            skip = false;
            continue;
          }
          if (c + 1 < row.length && row[c] === row[c + 1]) {
            const mergedVal = row[c] * 2;
            newRow.push(mergedVal);
            scoreGain += mergedVal;
            mergeCount++;
            if (mergedVal > maxMerged) maxMerged = mergedVal;
            skip = true;
            moved = true;
          } else {
            newRow.push(row[c]);
          }
        }

        while (newRow.length < 4) newRow.push(0);

        for (let c = 0; c < 4; c++) {
          if (working[r][c] !== newRow[c]) moved = true;
          working[r][c] = newRow[c];
        }
      }

      // Rotate back
      const backRotations = (4 - rotations) % 4;
      for (let i = 0; i < backRotations; i++) {
        working = rotate(working);
      }

      if (!moved) return;

      // Save history for undo (keep up to 5)
      setHistory((prev) => [...prev.slice(-4), { board, score }]);

      // Spawn tile
      const nextBoard = spawnRandomTile(working);
      const newScore = score + scoreGain;
      const newMoves = moves + 1;

      setBoard(nextBoard);
      setScore(newScore);
      setMoves(newMoves);
      setAiAdvice(null);

      // Best score check
      if (newScore > bestScore) {
        setBestScore(newScore);
        if (typeof window !== 'undefined') {
          localStorage.setItem('uyiz_2048_best', String(newScore));
        }
      }

      // Sounds & Combo feedback
      if (mergeCount > 0) {
        sound.playMerge(maxMerged);
        if (mergeCount >= 2) {
          sound.playCombo(mergeCount);
          setCombo({ text: `${mergeCount}x COMBO! 🔥`, id: Date.now() });
        }
        setFloatingScore({ points: scoreGain, id: Date.now() });
      } else {
        sound.playMove();
      }

      // Check max tile on board
      let currentMax = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (nextBoard[r][c] > currentMax) currentMax = nextBoard[r][c];
        }
      }

      checkAchievements(newScore, currentMax, mergeCount);

      // Check victory
      if (currentMax >= 2048 && !hasWon && !dismissWon) {
        setHasWon(true);
        sound.playVictory();
      }

      // Check game over
      if (checkGameOver(nextBoard)) {
        setGameOver(true);
        setAutoPlay(false);
        sound.playGameOver();
      }
    },
    [board, score, moves, bestScore, gameOver, hasWon, dismissWon, spawnRandomTile, checkAchievements, checkGameOver]
  );

  // Undo move
  const handleUndo = useCallback(() => {
    if (history.length === 0 || undos <= 0 || gameOver) return;
    const previous = history[history.length - 1];
    setBoard(previous.board);
    setScore(previous.score);
    setHistory((prev) => prev.slice(0, -1));
    setUndos((prev) => prev - 1);
    setAiAdvice(null);
    sound.playMove();
  }, [history, undos, gameOver]);

  // Request AI Advice
  const handleAskAi = useCallback(() => {
    const advice = getAiRecommendation(board);
    setAiAdvice(advice);
    sound.playCombo(2);
  }, [board]);

  // Auto-play interval
  useEffect(() => {
    if (!autoPlay || gameOver) return;

    const timer = setInterval(() => {
      const advice = getAiRecommendation(board);
      if (advice.bestMove) {
        move(advice.bestMove);
      } else {
        setAutoPlay(false);
      }
    }, 380);

    return () => clearInterval(timer);
  }, [autoPlay, board, gameOver, move]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') move('UP');
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') move('DOWN');
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') move('LEFT');
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') move('RIGHT');
      else if (e.key === 'u' || e.key === 'U') handleUndo();
      else if (e.key === 'h' || e.key === 'H') handleAskAi();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, handleUndo, handleAskAi]);

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    const end = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const minSwipe = 35;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > minSwipe) {
        if (dx > 0) move('RIGHT');
        else move('LEFT');
      }
    } else {
      if (Math.abs(dy) > minSwipe) {
        if (dy > 0) move('DOWN');
        else move('UP');
      }
    }
    touchStartRef.current = null;
  };

  // Switch Theme
  const changeTheme = (newTheme: GameTheme) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('uyiz_2048_theme', newTheme);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Controls & Scoreboard */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-3xl bg-surface border border-line shadow-card">
        {/* Game Title & Brand badge */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              2048
            </span>
            <span
              className="px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
            >
              Uyiz Edition
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Binolarni birlashtirib, Uyiz Imperiyasini quring!
          </p>
        </div>

        {/* Scores & Stats */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Current Score */}
          <div className="relative px-4 py-2 rounded-2xl bg-surface-2 border border-line text-center min-w-[90px]">
            <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
              Ball
            </span>
            <span className="text-lg font-black block" style={{ color: 'var(--color-text-primary)' }}>
              {score}
            </span>

            {/* Floating score popup */}
            {floatingScore && (
              <span
                key={floatingScore.id}
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-black text-emerald-500 animate-bounce pointer-events-none"
              >
                +{floatingScore.points}
              </span>
            )}
          </div>

          {/* Best Score */}
          <div className="px-4 py-2 rounded-2xl bg-surface-2 border border-line text-center min-w-[90px]">
            <span className="text-[10px] uppercase font-bold tracking-wider block flex items-center justify-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <Trophy size={11} className="text-amber-500" /> Rekord
            </span>
            <span className="text-lg font-black block" style={{ color: 'var(--color-text-primary)' }}>
              {bestScore}
            </span>
          </div>

          {/* Moves Count */}
          <div className="px-3.5 py-2 rounded-2xl bg-surface-2 border border-line text-center min-w-[70px]">
            <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: 'var(--color-text-muted)' }}>
              Yurish
            </span>
            <span className="text-lg font-black block" style={{ color: 'var(--color-text-primary)' }}>
              {moves}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setMuted(sound.toggleMute())}
            title={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
            className="p-2.5 rounded-2xl bg-surface-2 border border-line hover:bg-surface-hover transition-colors text-muted hover:text-content"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* Toolbar: Themes, AI Hint, Auto-Play, Undo, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-surface border border-line">
        {/* Left: Theme Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-line text-xs font-bold">
          <button
            type="button"
            onClick={() => changeTheme('uyiz')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              theme === 'uyiz' ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-content'
            }`}
          >
            <Building2 size={14} /> Uyiz
          </button>
          <button
            type="button"
            onClick={() => changeTheme('classic')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              theme === 'classic' ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-content'
            }`}
          >
            <Palette size={14} /> Klassik
          </button>
          <button
            type="button"
            onClick={() => changeTheme('cyberpunk')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              theme === 'cyberpunk' ? 'bg-surface text-brand shadow-sm' : 'text-muted hover:text-content'
            }`}
          >
            <Sparkles size={14} /> Kiber
          </button>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Hint Button */}
          <button
            type="button"
            onClick={handleAskAi}
            title="Aqlli maslahat olish (H)"
            className="px-3.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-500/20 transition-all active:scale-95"
          >
            <Bot size={15} />
            <span>AI Maslahat</span>
          </button>

          {/* AI Auto-Play Toggle */}
          <button
            type="button"
            onClick={() => setAutoPlay(!autoPlay)}
            title={autoPlay ? 'Avto-o‘yinni to‘xtatish' : 'AI avtomatik o‘ynasin'}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
              autoPlay
                ? 'bg-purple-600 text-white shadow-md animate-pulse'
                : 'border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
            }`}
          >
            {autoPlay ? <Pause size={14} /> : <Play size={14} />}
            <span>{autoPlay ? 'To‘xtatish' : 'AI Avto'}</span>
          </button>

          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0 || undos <= 0}
            title={`Qaytarish (${undos} ta qoldi) [U]`}
            className="px-3.5 py-1.5 rounded-xl border border-line bg-surface-2 text-content font-bold text-xs flex items-center gap-1.5 hover:bg-surface-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <RotateCcw size={14} />
            <span>Qaytarish ({undos})</span>
          </button>

          {/* New Game */}
          <button
            type="button"
            onClick={resetGame}
            title="Qayta boshlash"
            className="px-3.5 py-1.5 rounded-xl bg-brand text-on-brand font-bold text-xs shadow-brand hover:opacity-95 transition-all active:scale-95"
          >
            Yangilash
          </button>
        </div>
      </div>

      {/* AI Advice Notification Banner */}
      {aiAdvice && aiAdvice.bestMove && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-300">
              <Bot size={18} />
            </div>
            <div>
              <span className="font-bold block text-sm">
                Tavsiya:{' '}
                {aiAdvice.bestMove === 'UP' && '⬆️ YUQORIGA'}
                {aiAdvice.bestMove === 'DOWN' && '⬇️ PASTGA'}
                {aiAdvice.bestMove === 'LEFT' && '⬅️ CHAPGA'}
                {aiAdvice.bestMove === 'RIGHT' && '➡️ O‘NGGA'}
                {' '}({aiAdvice.confidence}% ishonch)
              </span>
              <span className="text-[11px] opacity-80 block">{aiAdvice.reason}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => move(aiAdvice.bestMove!)}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs shrink-0 shadow hover:opacity-90 transition-opacity"
          >
            Bajarish
          </button>
        </div>
      )}

      {/* Combo Banner */}
      {combo && (
        <div
          key={combo.id}
          className="text-center py-1.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm tracking-wider shadow-lg animate-bounce"
        >
          {combo.text}
        </div>
      )}

      {/* Main 4x4 Game Board */}
      <div className="relative mx-auto w-full max-w-[420px] aspect-square select-none">
        <div
          ref={boardRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="w-full h-full p-3.5 rounded-3xl border border-line grid grid-cols-4 grid-rows-4 gap-3 relative shadow-2xl overflow-hidden"
          style={{
            background: theme === 'cyberpunk' ? '#090d16' : 'var(--color-surface-hover)',
          }}
        >
          {/* 16 Cells Grid */}
          {board.map((row, r) =>
            row.map((val, c) => {
              const isEmpty = val === 0;

              // Tile appearance
              let tileBg = theme === 'cyberpunk' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.05)';
              let textColor = 'inherit';
              let glow: string | undefined;
              let title = '';
              let sub = '';
              let icon = '';

              if (!isEmpty) {
                if (theme === 'uyiz') {
                  const meta = UYIZ_TILES[val] || {
                    label: `${val}`,
                    sub: 'Mega',
                    icon: '💎',
                    color: 'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)',
                    textColor: '#ffffff',
                  };
                  tileBg = meta.color;
                  textColor = meta.textColor;
                  glow = meta.glow;
                  title = meta.label;
                  sub = meta.sub;
                  icon = meta.icon;
                } else if (theme === 'classic') {
                  const meta = CLASSIC_TILES[val] || CLASSIC_TILES[4096];
                  tileBg = meta.color;
                  textColor = meta.textColor;
                  glow = meta.glow;
                  title = `${val}`;
                } else {
                  const meta = CYBERPUNK_TILES[val] || CYBERPUNK_TILES[4096];
                  tileBg = meta.color;
                  textColor = meta.textColor;
                  glow = meta.glow;
                  title = `${val}`;
                }
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`w-full h-full rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-150 ${
                    isEmpty ? '' : 'scale-100 shadow-md animate-scale-in'
                  }`}
                  style={{
                    background: tileBg,
                    color: textColor,
                    boxShadow: glow,
                  }}
                >
                  {!isEmpty && (
                    <>
                      {theme === 'uyiz' ? (
                        <div className="flex flex-col items-center justify-center p-1 text-center select-none">
                          <span className="text-xl sm:text-2xl leading-none mb-0.5">{icon}</span>
                          <span className="text-[10px] sm:text-xs font-black leading-tight tracking-tight truncate max-w-full">
                            {title}
                          </span>
                          <span className="text-[9px] font-mono font-bold opacity-80">{val}</span>
                        </div>
                      ) : (
                        <span
                          className={`font-black tracking-tight leading-none ${
                            val >= 1024
                              ? 'text-lg sm:text-xl'
                              : val >= 128
                              ? 'text-xl sm:text-2xl'
                              : 'text-2xl sm:text-3xl'
                          }`}
                        >
                          {val}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Victory Overlay */}
          {hasWon && !dismissWon && (
            <div className="absolute inset-0 z-20 rounded-3xl bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in">
              <span className="text-5xl mb-2">👑</span>
              <h3 className="text-2xl font-black text-amber-400">UYIZ IMPERIYASI QURILDI!</h3>
              <p className="text-xs text-white/80 mt-1 max-w-xs">
                Tabriklaymiz! Siz 2048 blokiga erishdingiz va haqiqiy ko‘chmas mulk qiroliga aylandingiz!
              </p>
              <div className="flex items-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setDismissWon(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg"
                >
                  Davom etish
                </button>
                <button
                  type="button"
                  onClick={resetGame}
                  className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs"
                >
                  Yangi o‘yin
                </button>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 z-20 rounded-3xl bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white animate-fade-in">
              <span className="text-4xl mb-2">🏙️</span>
              <h3 className="text-2xl font-black text-rose-400">O‘YIN TUGADI!</h3>
              <p className="text-xs text-white/80 mt-1">Boshqa bo‘sh joy yoki birlashish imkoni qolmadi.</p>
              <div className="mt-3 p-3 rounded-xl bg-white/10 text-xs font-bold">
                Jami to‘plangan ball: <span className="text-amber-400 text-sm font-black">{score}</span>
              </div>
              <div className="flex items-center gap-2.5 mt-5">
                {undos > 0 && history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setGameOver(false);
                      handleUndo();
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow"
                  >
                    1 qadam orqaga ({undos})
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetGame}
                  className="px-4 py-2 rounded-xl bg-brand text-on-brand font-bold text-xs shadow-brand"
                >
                  Qaytadan boshlash
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-screen D-Pad Controls for mobile / touch / clicks */}
      <div className="flex flex-col items-center justify-center gap-1.5 pt-2">
        <button
          type="button"
          onClick={() => move('UP')}
          aria-label="Yuqoriga"
          className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center hover:bg-surface-hover active:scale-95 transition-all text-content shadow-sm"
        >
          <ArrowUp size={20} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move('LEFT')}
            aria-label="Chapga"
            className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center hover:bg-surface-hover active:scale-95 transition-all text-content shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => move('DOWN')}
            aria-label="Pastga"
            className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center hover:bg-surface-hover active:scale-95 transition-all text-content shadow-sm"
          >
            <ArrowDown size={20} />
          </button>
          <button
            type="button"
            onClick={() => move('RIGHT')}
            aria-label="O‘ngga"
            className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center hover:bg-surface-hover active:scale-95 transition-all text-content shadow-sm"
          >
            <ArrowRight size={20} />
          </button>
        </div>
        <span className="text-[11px] font-medium text-muted mt-1">
          Klaviatura strelkalari yoki W, A, S, D tugmalaridan foydalanishingiz mumkin
        </span>
      </div>

      {/* Achievements Section */}
      <div className="p-5 rounded-3xl bg-surface border border-line shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <span className="text-sm font-bold text-content">Admin Yutuqlari (Achievements)</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-surface-2 text-muted">
            {achievements.filter((a) => a.unlocked).length} / {achievements.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                ach.unlocked
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-surface-2 border-line opacity-50'
              }`}
            >
              <span className="text-2xl shrink-0">{ach.icon}</span>
              <div className="min-w-0">
                <span className="text-xs font-bold block truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {ach.title}
                </span>
                <span className="text-[10px] block leading-tight text-muted mt-0.5">
                  {ach.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
