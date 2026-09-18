'use client';

import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useMounted } from './useMounted';
import { Move } from 'lucide-react';

interface DockHintProps {
  progress: number;
  armed: boolean;
  dragging: boolean;
}

/**
 * Fixed, center-top pill that makes the press-and-hold pickup gesture
 * discoverable and legible: it fills a ring over the ~3s hold, flips to an
 * "armed — drag to a side" state once picked up, and disappears on drop.
 * Purely presentational; pointer-events are off so it never blocks the drag.
 */
export function DockHint({ progress, armed, dragging }: DockHintProps) {
  const t = useTranslations('dock');
  const mounted = useMounted();

  // Only surface the hint once the hold is clearly intentional (well past a
  // normal click). Below the threshold this renders nothing, so a plain click
  // on a nav link or a dropdown never flashes the "hold to move" pill.
  const REVEAL_AT = 0.45;
  if (!mounted || (!armed && progress < REVEAL_AT)) return null;

  const R = 13;
  const C = 2 * Math.PI * R;
  // Remap the visible ring so it starts filling from the reveal point, not 0.
  const pct = armed ? 1 : Math.max(0, (progress - REVEAL_AT) / (1 - REVEAL_AT));

  return createPortal(
    <div
      className="fixed left-1/2 top-6 z-[999999] -translate-x-1/2 pointer-events-none animate-fade-in"
    >
      <div
        className="flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full"
        style={{
          background: armed ? 'var(--accent)' : 'var(--color-surface)',
          border: `1px solid ${armed ? 'var(--accent)' : 'var(--color-border)'}`,
          boxShadow: 'var(--shadow-modal)',
          color: armed ? '#fff' : 'var(--color-text-primary)',
          transition: 'background 0.2s ease, color 0.2s ease',
        }}
      >
        {armed ? (
          <Move size={16} className="shrink-0" />
        ) : (
          <span className="relative flex items-center justify-center shrink-0" style={{ width: 30, height: 30 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" className="-rotate-90">
              <circle cx="15" cy="15" r={R} fill="none" stroke="var(--color-surface-3)" strokeWidth="3" />
              <circle
                cx="15" cy="15" r={R}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
              />
            </svg>
          </span>
        )}
        <span className="text-xs font-semibold whitespace-nowrap">
          {armed ? (dragging ? t('release_hint') : t('drag_hint')) : t('hold_hint')}
        </span>
      </div>
    </div>,
    document.body,
  );
}
