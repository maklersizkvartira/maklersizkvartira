'use client';

import { type ReactNode } from 'react';

/**
 * Staggers a card into view so the eye is walked down the page exactly once.
 *
 * It reuses the panel's existing `.animate-fade-in-up` keyframe rather than
 * inventing a second entrance — the dashboard should not animate differently
 * from the eleven pages around it, it should animate in a different ORDER.
 * The extra `.dash-reveal` marker is what lets the reduced-motion block in
 * globals.css null this stagger without disarming `.animate-fade-in-up`
 * everywhere else in the panel.
 *
 * The delay is capped so a long stack never leaves its last card waiting on
 * an animation the reader has already scrolled past.
 */

interface RevealProps {
  /** Position in the reading order, not in the DOM. */
  index: number;
  /** Milliseconds between neighbours. */
  step?: number;
  /** Ceiling on the computed delay. */
  cap?: number;
  as?: 'div' | 'section' | 'li';
  className?: string;
  children: ReactNode;
}

export function Reveal({
  index,
  step = 60,
  cap = 420,
  as: Tag = 'div',
  className = '',
  children,
}: RevealProps) {
  return (
    <Tag
      className={`dash-reveal animate-fade-in-up ${className}`}
      style={{ animationDelay: `${Math.min(index * step, cap)}ms` }}
    >
      {children}
    </Tag>
  );
}
