/**
 * The brand lockup: mark + wordmark.
 *
 * Two problems this solves.
 *
 * 1. About a tenth of the mark is white (the house walls), so on a light
 *    surface those faces disappear and the roof floats. The mark therefore
 *    always sits on a brand-blue tile, drawn in CSS so it stays crisp at any
 *    size and follows the theme.
 *
 * 2. The wordmark is "Maklersiz" in brand blue and "Uy" in white. White text
 *    needs something behind it on a light page, so "Uy" is set in a solid blue
 *    chip — which also gives the name a mark of its own.
 */

import React from 'react';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  size?: LogoSize;
  /** Mark only — for tight spaces like the mobile bar. */
  markOnly?: boolean;
  /** Adds the tagline under the wordmark. */
  tagline?: string;
  className?: string;
  inverted?: boolean;
}

const SIZES: Record<
  LogoSize,
  { tile: string; mark: string; radius: string; word: string; chip: string; gap: string }
> = {
  sm: { tile: 'h-7 w-7', mark: 'h-5 w-5', radius: 'rounded-lg', word: 'text-sm', chip: 'px-1.5 py-px', gap: 'gap-1.5' },
  md: { tile: 'h-9 w-9', mark: 'h-6 w-6', radius: 'rounded-xl', word: 'text-base', chip: 'px-1.5 py-0.5', gap: 'gap-2' },
  lg: { tile: 'h-11 w-11', mark: 'h-8 w-8', radius: 'rounded-2xl', word: 'text-xl', chip: 'px-2 py-0.5', gap: 'gap-2.5' },
  xl: { tile: 'h-16 w-16', mark: 'h-11 w-11', radius: 'rounded-[1.25rem]', word: 'text-3xl', chip: 'px-2.5 py-1', gap: 'gap-3' },
};

export const LogoMark: React.FC<{ size?: LogoSize; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const s = SIZES[size];
  return (
    <img
      src="/brand/mark-128.png"
      alt=""
      width={128}
      height={128}
      className={`shrink-0 object-contain ${s.tile} ${className}`}
      draggable={false}
    />
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  markOnly = false,
  tagline,
  className = '',
  inverted = false,
}) => {
  const s = SIZES[size];

  if (markOnly) return <LogoMark size={size} className={className} />;

  return (
    // `inline-flex` last so a caller-supplied display utility is not silently
    // overridden by class order; callers should wrap instead of passing one.
    <span className={`${className} inline-flex items-center ${s.gap}`}>
      <LogoMark size={size} />
      <span className="inline-flex flex-col leading-none">
        {/* One accessible name for the whole lockup; the pieces are decorative. */}
        <span className="sr-only">Maklersiz Uy</span>
        <span
          className={`inline-flex items-center gap-1 font-black tracking-tight ${s.word}`}
          aria-hidden="true"
        >
          <span className={inverted ? 'text-white font-black' : 'text-brand font-black'}>Maklersiz</span>
          <span className={inverted ? 'text-white font-black' : 'text-content font-black'}>Uy</span>
        </span>
        {tagline && (
          <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${inverted ? 'text-white/70' : 'text-subtle'}`}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
};

export default Logo;
