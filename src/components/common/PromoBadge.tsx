/**
 * The VIP and TOP marks on a promoted listing, drawn once.
 *
 * The first version was a purple-to-indigo gradient with a gold crown, a
 * glow, a blur and — on the detail page — a pulse. It read as a game
 * power-up, and the card and the detail page each had their own copy of it
 * with slightly different sizes and words.
 *
 * This one is the mark a paid placement gets in print: a dark plate, a thin
 * gold rule, small spaced capitals. It is the same object in both places,
 * with `size` deciding how much room it takes, and the gold is the only
 * colour — so on the busiest grid the eye reads "VIP" as a label on the
 * photo, not as a second photo competing with it.
 */

import React from 'react';
import { Crown, Flame } from 'lucide-react';

import { cn } from '../../lib/cn';

interface PromoBadgeProps {
  kind: 'vip' | 'top';
  size?: 'sm' | 'md';
  className?: string;
}

const KINDS = {
  vip: {
    label: 'VIP',
    Icon: Crown,
    frame: 'border-amber-300/70 text-amber-200',
    icon: 'text-amber-300',
  },
  top: {
    label: 'TOP',
    Icon: Flame,
    frame: 'border-orange-300/70 text-orange-100',
    icon: 'text-orange-300',
  },
} as const;

export const PromoBadge: React.FC<PromoBadgeProps> = ({ kind, size = 'sm', className }) => {
  const { label, Icon, frame, icon } = KINDS[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border bg-neutral-950/85 font-bold uppercase text-white shadow-md backdrop-blur-sm',
        size === 'sm' ? 'gap-1 px-2 py-0.5 text-[10px] tracking-[0.18em]' : 'gap-1.5 px-2.5 py-1 text-[11px] tracking-[0.2em]',
        frame,
        className,
      )}
    >
      <Icon
        className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', icon)}
        strokeWidth={2.25}
        aria-hidden="true"
      />
      {label}
    </span>
  );
};

export default PromoBadge;
