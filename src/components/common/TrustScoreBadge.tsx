/**
 * Trust score chip.
 *
 * The score band picks both the icon and a soft token pair. Solid brand/red
 * fills were dropped because the dark palette lightens those hues, which left
 * white label text unreadable on them; the tints carry the same signal and
 * stay legible in both themes.
 */

import React from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

import { useTranslation } from '../../i18n';

interface TrustScoreBadgeProps {
  score: number;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TrustTone {
  className: string;
  Icon: typeof ShieldCheck;
}

/** Bands mirror ListingCard's trust chip so one listing reads the same everywhere. */
function trustTone(score: number): TrustTone {
  if (score >= 80) return { className: 'bg-brand-soft text-brand-text', Icon: ShieldCheck };
  if (score >= 60) return { className: 'bg-info-soft text-info', Icon: ShieldCheck };
  if (score >= 40) return { className: 'bg-warning-soft text-warning', Icon: Shield };
  return { className: 'bg-danger-soft text-danger', Icon: ShieldAlert };
}

const SIZE_CLASSES: Record<NonNullable<TrustScoreBadgeProps['size']>, string> = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3.5 py-1.5 gap-2',
};

const ICON_CLASSES: Record<NonNullable<TrustScoreBadgeProps['size']>, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  showText = true,
  size = 'md',
}) => {
  const { t, formatNumber } = useTranslation();

  const { className, Icon } = trustTone(score);
  const label = t('common.badge.trustScore', { score });

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${className} ${SIZE_CLASSES[size]}`}
      title={label}
    >
      <Icon className={ICON_CLASSES[size]} aria-hidden="true" />
      {/* Without the text the bare number needs the label for screen readers. */}
      {showText ? (
        <span>{label}</span>
      ) : (
        <>
          <span aria-hidden="true">{formatNumber(score)}</span>
          <span className="sr-only">{label}</span>
        </>
      )}
    </span>
  );
};

export default TrustScoreBadge;
