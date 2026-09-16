/**
 * The mark of Uyiz's own support account.
 *
 * Deliberately not `BlueVerifiedBadge`. That one is the scalloped cyan check
 * a paying owner or agent gets next to their name, and if the support desk
 * wore the same mark, "verified" would mean two different things on one
 * screen — a customer we checked, and us. This is a different object: a
 * shield, in the brand's blue running into violet, with a white keyline so
 * it holds on a photo, a dark bubble and a light card alike. Nobody else on
 * the site can have it, because nothing else renders it.
 *
 * The gradient id comes from `useId`: a fixed id, which the older badge
 * uses, is duplicated the moment two badges share a page and the second
 * one silently takes the first one's colours.
 */

import React, { useId } from 'react';

import { useTranslation } from '../../i18n';

interface OfficialBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const SIZES = { xs: 'h-3.5 w-3.5', sm: 'h-4 w-4', md: 'h-5 w-5' } as const;

export const OfficialBadge: React.FC<OfficialBadgeProps> = ({ size = 'sm', className = '' }) => {
  const { t } = useTranslation();
  const gradientId = useId();
  const label = t('chat.support.official');

  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center align-middle ${className}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <svg className={`${SIZES[size]} drop-shadow-[0_1px_2px_rgba(37,99,235,0.45)]`} viewBox="0 0 24 24" fill="none">
        {/* Shield: flat shoulders, a point at the foot. */}
        <path
          d="M12 1.75 20.25 4.6v6.2c0 5.05-3.3 9.05-8.25 11.45C7.05 19.85 3.75 15.85 3.75 10.8V4.6L12 1.75z"
          fill={`url(#${gradientId})`}
          stroke="#FFFFFF"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        <path
          d="m8.2 12.1 2.5 2.5 5.1-5.3"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="0.55" stopColor="#4F46E5" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
};

export default OfficialBadge;
