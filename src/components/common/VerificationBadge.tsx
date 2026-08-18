import React from 'react';
import { CheckCircle2, Award, Building, Sparkles } from 'lucide-react';
import { VerificationLevel } from '../../types';

interface VerificationBadgeProps {
  level: VerificationLevel;
  size?: 'sm' | 'md';
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ level = 4, size = 'md' }) => {
  const levelsMap = {
    1: { name: 'Level 1: Phone Verified', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: CheckCircle2 },
    2: { name: 'Level 2: ID Verified', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
    3: { name: 'Level 3: Selfie Verified', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Award },
    4: { name: 'Level 4: Property Verified', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold', icon: Building },
    5: { name: 'Level 5: VIP Verified Owner', color: 'bg-amber-500 text-white border-amber-600 font-bold shadow-sm', icon: Sparkles },
  };

  const levelData = levelsMap[(level || 4) as keyof typeof levelsMap] || levelsMap[4];
  const Icon = levelData.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 border rounded-md ${levelData.color} ${padding}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {levelData.name}
    </span>
  );
};
