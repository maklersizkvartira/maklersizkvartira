import React from 'react';

interface FortuneWheel3DIconProps {
  className?: string;
  size?: number;
  isHovered?: boolean;
  isSpinning?: boolean;
}

export const FortuneWheel3DIcon: React.FC<FortuneWheel3DIconProps> = ({
  className = '',
  size = 56,
  isHovered = false,
  isSpinning = false,
}) => {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_20px_rgba(245,158,11,0.5)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Outer 3D Gold Rim Gradient */}
          <linearGradient id="goldRimExt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE57F" />
            <stop offset="25%" stopColor="#FFB300" />
            <stop offset="50%" stopColor="#FFF8E1" />
            <stop offset="75%" stopColor="#FF8F00" />
            <stop offset="100%" stopColor="#FFE082" />
          </linearGradient>

          {/* Center Hub 3D */}
          <radialGradient id="centerHub" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="30%" stopColor="#FFD54F" />
            <stop offset="70%" stopColor="#FF8F00" />
            <stop offset="100%" stopColor="#BF360C" />
          </radialGradient>

          {/* Ruby Gem in Center */}
          <radialGradient id="rubyGem" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FF8A80" />
            <stop offset="40%" stopColor="#E53935" />
            <stop offset="85%" stopColor="#B71C1C" />
            <stop offset="100%" stopColor="#4A0000" />
          </radialGradient>

          {/* Needle Gold Gradient */}
          <linearGradient id="needleGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD54F" />
            <stop offset="50%" stopColor="#FFF8E1" />
            <stop offset="100%" stopColor="#FF8F00" />
          </linearGradient>

          {/* Subtle Sector Drop Shadow Filter */}
          <filter id="hubShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* 3D Depth Base Ring */}
        <circle cx="60" cy="62" r="54" fill="#3E2723" opacity="0.6" />
        <circle cx="60" cy="60" r="54" fill="url(#goldRimExt)" stroke="#FFA000" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="48" fill="#1E293B" stroke="#78350F" strokeWidth="1.5" />

        {/* ROTATING WHEEL BODY (CHIRPIRAK AYLANYAPTI) */}
        <g
          className={`origin-[60px_60px] ${
            isHovered || isSpinning
              ? 'animate-[spin_2s_linear_infinite]'
              : 'animate-[spin_6s_linear_infinite]'
          }`}
        >
          <g transform="translate(60, 60)">
            {/* Sector 1: Red/Coral */}
            <path
              d="M 0 0 L 0 -47 A 47 47 0 0 1 33.23 -33.23 Z"
              fill="#EF4444"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 2: Purple */}
            <path
              d="M 0 0 L 33.23 -33.23 A 47 47 0 0 1 47 0 Z"
              fill="#8B5CF6"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 3: Cyan */}
            <path
              d="M 0 0 L 47 0 A 47 47 0 0 1 33.23 33.23 Z"
              fill="#06B6D4"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 4: Emerald */}
            <path
              d="M 0 0 L 33.23 33.23 A 47 47 0 0 1 0 47 Z"
              fill="#10B981"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 5: Amber/Orange */}
            <path
              d="M 0 0 L 0 47 A 47 47 0 0 1 -33.23 33.23 Z"
              fill="#F59E0B"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 6: Pink */}
            <path
              d="M 0 0 L -33.23 33.23 A 47 47 0 0 1 -47 0 Z"
              fill="#EC4899"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 7: Blue */}
            <path
              d="M 0 0 L -47 0 A 47 47 0 0 1 -33.23 -33.23 Z"
              fill="#3B82F6"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />
            {/* Sector 8: Gold Jackpot */}
            <path
              d="M 0 0 L -33.23 -33.23 A 47 47 0 0 1 0 -47 Z"
              fill="#EAB308"
              stroke="#FEF08A"
              strokeWidth="0.8"
            />

            {/* Outer Golden Studs (8 lights on rim) */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = Math.sin(rad) * 51;
              const y = -Math.cos(rad) * 51;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="2.8" fill="#FFF59D" />
                  <circle cx={x} cy={y} r="1.8" fill="#FFF" />
                </g>
              );
            })}

            {/* Sector Coin Icons (mini 3D tokens) */}
            <circle cx="12" cy="-28" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="28" cy="-12" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="28" cy="12" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="12" cy="28" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="-12" cy="28" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="-28" cy="12" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="-28" cy="-12" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
            <circle cx="-12" cy="-28" r="4.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
          </g>

          {/* 3D Center Hub (Raised Gold + Ruby) */}
          <circle cx="60" cy="62" r="16" fill="#451A03" opacity="0.5" filter="url(#hubShadow)" />
          <circle cx="60" cy="60" r="16" fill="url(#centerHub)" stroke="#FFE082" strokeWidth="1.2" />
          <circle cx="60" cy="60" r="10" fill="url(#rubyGem)" stroke="#FFCDD2" strokeWidth="1" />
          {/* Diamond Glint on Ruby */}
          <ellipse cx="57" cy="57" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.85" transform="rotate(-30 57 57)" />
        </g>

        {/* Top 3D Golden Pointer (Needle) stationary pointing down */}
        <g filter="url(#hubShadow)">
          <path
            d="M 54 4 Q 60 2 66 4 L 63 24 Q 60 26 57 24 Z"
            fill="url(#needleGold)"
            stroke="#B45309"
            strokeWidth="0.8"
          />
          <circle cx="60" cy="9" r="2.8" fill="#DC2626" stroke="#FEF08A" strokeWidth="0.8" />
        </g>
      </svg>

      {/* Ambient Pulsing Glow behind wheel */}
      <div className="absolute inset-0 rounded-full bg-amber-400/30 blur-lg -z-10 animate-pulse pointer-events-none" />
    </div>
  );
};
