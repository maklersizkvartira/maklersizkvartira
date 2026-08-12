import React from 'react';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

interface TrustScoreBadgeProps {
  score: number;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  showText = true,
  size = 'md',
}) => {
  let bgColor = 'bg-emerald-600 text-white';
  let label = 'Verified Trust';
  let Icon = ShieldCheck;

  if (score >= 90) {
    bgColor = 'bg-emerald-700 text-white shadow-emerald-200 shadow-md';
    label = 'Verified Trust (90+)';
    Icon = ShieldCheck;
  } else if (score >= 70) {
    bgColor = 'bg-emerald-600 text-white';
    label = 'Trusted Owner';
    Icon = ShieldCheck;
  } else if (score >= 50) {
    bgColor = 'bg-amber-500 text-white';
    label = 'Medium Trust';
    Icon = Shield;
  } else {
    bgColor = 'bg-rose-600 text-white';
    label = 'High Risk';
    Icon = ShieldAlert;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3.5 py-1.5 gap-2 font-bold',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium transition-all ${bgColor} ${sizeClasses}`}
      title={`Trust Score: ${score}/100`}
    >
      <Icon className={iconSizes} />
      <span>{score}</span>
      {showText && <span className="opacity-95 text-xs font-normal">| {label}</span>}
    </div>
  );
};
