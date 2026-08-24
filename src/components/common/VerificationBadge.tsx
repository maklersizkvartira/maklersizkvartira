/**
 * Owner verification level chip.
 *
 * Four of the five levels used to be a pale tint on a light border, which
 * disappeared entirely against the dark canvas. Every level now names a
 * token pair, and level 4 — the one that actually matters to a renter, the
 * verified property document — keeps its solid brand fill via `text-on-brand`.
 */

import React from 'react';
import { Award, Building, CheckCircle2, Sparkles } from 'lucide-react';

import { useTranslation } from '../../i18n';
import type { VerificationLevel } from '../../types';

interface VerificationBadgeProps {
  level: VerificationLevel;
  size?: 'sm' | 'md';
}

const LEVELS: Record<VerificationLevel, { className: string; Icon: typeof CheckCircle2 }> = {
  1: { className: 'bg-surface-2 text-muted border-line-2', Icon: CheckCircle2 },
  2: { className: 'bg-info-soft text-info border-info/40', Icon: CheckCircle2 },
  3: { className: 'bg-brand-soft-2 text-brand-text border-brand/40', Icon: Award },
  4: { className: 'bg-brand text-on-brand border-brand font-semibold', Icon: Building },
  5: {
    className: 'bg-warning-soft text-warning border-warning/50 font-bold ring-1 ring-warning/25',
    Icon: Sparkles,
  },
};

function isVerificationLevel(value: number): value is VerificationLevel {
  return value >= 1 && value <= 5 && Number.isInteger(value);
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ level, size = 'md' }) => {
  const { t } = useTranslation();

  // Callers read the level off API data, so an out-of-range value is possible.
  const safeLevel: VerificationLevel = isVerificationLevel(level) ? level : 4;
  const { className, Icon } = LEVELS[safeLevel];
  const label = t('common.badge.verificationLevel', { level: safeLevel });

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border text-xs ${className} ${
        size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
      }`}
      title={label}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
      {label}
    </span>
  );
};

export default VerificationBadge;
