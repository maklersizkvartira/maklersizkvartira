/**
 * The brand lockup: mark + wordmark.
 *
 * Two problems this solves.
 *
 * 1. About a tenth of the mark is white (the house walls), so on a light
 *    surface those faces would disappear and the roof float. The artwork
 *    carries its own outlines to hold them, which is why the mark is now the
 *    flat PNG at /brand/mark-128.png rather than the glyph on a CSS
 *    brand-blue tile it used to be — if it is ever redrawn without those
 *    outlines, the tile is what has to come back.
 *
 * 2. The wordmark is two words in two colours, and "Uy" is the blue one in
 *    both variants. The chip that used to sit behind it is gone — the word is
 *    plain text now — so the blue itself has to do the separating, and on the
 *    header's navy band that means a different blue from the one used on a
 *    light page. The figures behind that choice are at `UY_ON_BAND` below.
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

// Only the three things something still reads. `chip`, `mark` and `radius`
// belonged to the tile-and-chip lockup and nothing has rendered them since it
// went; a size table that keeps paddings for a chip that does not exist is how
// the next reader ends up wiring one back.
const SIZES: Record<LogoSize, { tile: string; word: string; gap: string }> = {
  sm: { tile: 'h-7 w-7', word: 'text-sm', gap: 'gap-1.5' },
  md: { tile: 'h-9 w-9', word: 'text-base', gap: 'gap-2' },
  lg: { tile: 'h-11 w-11', word: 'text-xl', gap: 'gap-2.5' },
  xl: { tile: 'h-16 w-16', word: 'text-3xl', gap: 'gap-3' },
};

/**
 * The blue "Uy" wears on the header band.
 *
 * `text-brand` is the right blue on a light page — #1447e6 on white is 6.8:1 —
 * but the band is #0e2a86, and brand-on-band measures 1.8:1. That is not a
 * colour, it is a silhouette, which is why the inverted lockup painted both
 * words white and lost the two-tone entirely.
 *
 * No single token is a light blue in both themes: `brand-soft-2` is a solid
 * #dbe5ff in light but a 22%-alpha fill in dark (invisible as text), and
 * `on-band` is so close to white it would not read as blue at all. So the
 * colour is mixed from the two tokens that are solid in both themes — the
 * brand blue lifted toward `on-band` until it clears the navy underneath it.
 * That measures 5.2:1 against `--color-band` in light and 8.2:1 in dark,
 * both above the 4.5:1 floor for body text and comfortably above the 3:1 the
 * wordmark's size would allow, while still reading blue next to the white
 * "Maklersiz". The band is dark in both themes, so one mix serves both.
 */
const UY_ON_BAND = 'text-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-on-band))]';

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
          {/* "Uy" is the blue word in BOTH variants — that is the whole point of
              the lockup, and painting both words brand blue on a light surface
              threw the two-tone away. "Maklersiz" therefore takes the neutral
              colour on light and white on the band. */}
          <span className={inverted ? 'text-white font-black' : 'text-content font-black'}>Maklersiz</span>
          <span className={inverted ? `${UY_ON_BAND} font-black` : 'text-brand font-black'}>Uy</span>
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
