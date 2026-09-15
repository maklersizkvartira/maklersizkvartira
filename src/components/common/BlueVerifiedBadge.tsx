import React from 'react';

interface BlueVerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
  tooltipText?: string;
}

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

/**
 * Rasmiy moviy tasdiqlanganlik nishoni (Telegram / Twitter uslubidagi yorqin ko'k galochka).
 * Galochkasi bor foydalanuvchilar (Mulkdor / Rieltor) yonida ko'rsatiladi.
 */
export const BlueVerifiedBadge: React.FC<BlueVerifiedBadgeProps> = ({
  size = 'sm',
  className = '',
  showTooltip = true,
  tooltipText = 'Tasdiqlangan foydalanuvchi (Rasmiy)',
}) => {
  const sizeClass = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none align-middle ${className}`}
      title={showTooltip ? tooltipText : undefined}
      aria-label={tooltipText}
    >
      <svg
        className={`${sizeClass} drop-shadow-[0_1px_2px_rgba(29,155,240,0.4)] transition-transform hover:scale-110`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Scalloped badge base with vibrant Twitter/Telegram blue gradient */}
        <path
          d="M22.5 12.5c0-1.58-.8-2.95-2-3.77.54-1.51.16-3.22-.99-4.38-1.15-1.15-2.87-1.53-4.38-.99-.82-1.2-2.19-2-3.77-2s-2.95.8-3.77 2c-1.51-.54-3.23-.16-4.38.99-1.15 1.16-1.53 2.87-.99 4.38-1.2.82-2 2.19-2 3.77s.8 2.95 2 3.77c-.54 1.51-.16 3.23.99 4.38 1.16 1.15 2.87 1.53 4.38.99.82 1.2 2.19 2 3.77 2s2.95-.8 3.77-2c1.51.54 3.22.16 4.38-.99 1.15-1.15 1.53-2.87.99-4.38 1.2-.82 2-2.19 2-3.77z"
          fill="url(#blue-verified-gradient)"
        />
        {/* Crisp checkmark in pure white */}
        <path
          d="M10.2 16.2L6.5 12.5L7.9 11.1L10.2 13.4L16.1 7.5L17.5 8.9L10.2 16.2Z"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="blue-verified-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#29B6F6" />
            <stop offset="0.5" stopColor="#0288D1" />
            <stop offset="1" stopColor="#01579B" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
};

export default BlueVerifiedBadge;
