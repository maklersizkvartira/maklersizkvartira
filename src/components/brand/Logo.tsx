/**
 * The brand lockup: the house mark + the "Uyiz" wordmark.
 *
 * Both halves are drawn from `public/logo-uyiz.png` and `public/logo-text-view.png`,
 * the artwork the brand was designed in. Three things are worth knowing before
 * changing anything here.
 *
 * 1. THE WORDMARK IS A PATH, NOT TEXT. It is Archivo Black at -0.02em, traced
 *    to outlines and inlined below. A webfont would have been fewer bytes, but
 *    the brand name would then render in whatever the fallback stack offers for
 *    the first few hundred milliseconds of every cold load — the one word on
 *    the page that must never be approximate. As a path it is exact, crisp at
 *    any size, needs no network, and cannot shift as it loads.
 *
 *    Archivo Black was chosen by measuring the reference artwork rather than by
 *    eye: its capital U is 0.999 of cap height against the artwork's 1.000, and
 *    its z is 0.751 against 0.763 — the closest of thirty candidates. Its y
 *    descends slightly deeper than the artwork's, which is the one visible
 *    difference and is under a pixel at the sizes this renders at.
 *
 * 2. THE WORD IS ONE COLOUR; ONLY THE CHEVRON IS BLUE. The artwork puts the
 *    house's roof over the i in place of its dot, and that caret is the only
 *    coloured thing in the word. An earlier version of this file painted "iz"
 *    blue as a two-tone lockup — that was wrong, and it is the reason the
 *    chevron is a separate path with its own fill.
 *
 * 3. THE MARK CARRIES ITS OWN OUTLINE. Roughly a third of it is white (the
 *    house walls and the right half of the cup), which on a white page would
 *    otherwise leave the blue roof floating. The PNG has a soft outline baked
 *    in that holds those faces on white, on the page grey, and on the header's
 *    navy band alike. If it is ever redrawn without that outline, the mark will
 *    need a tinted tile behind it again.
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

/**
 * Heights, not boxes.
 *
 * The mark is 0.79 as wide as it is tall, so the square tiles this table used
 * to hold left it `object-contain`ed inside them — drawn at 79% of the space it
 * was given and reading small beside the word. Everything is sized by height
 * now and takes whatever width its own proportions ask for.
 */
const SIZES: Record<LogoSize, { mark: string; word: string; gap: string; tagline: string }> = {
  sm: { mark: 'h-7', word: 'h-[0.95rem]', gap: 'gap-1.5', tagline: 'text-[9px]' },
  md: { mark: 'h-9', word: 'h-[1.15rem]', gap: 'gap-2', tagline: 'text-[10px]' },
  lg: { mark: 'h-11', word: 'h-[1.5rem]', gap: 'gap-2.5', tagline: 'text-[11px]' },
  xl: { mark: 'h-16', word: 'h-[2.2rem]', gap: 'gap-3', tagline: 'text-xs' },
};

/**
 * The wordmark, traced from Archivo Black.
 *
 * The viewBox spans the chevron's apex down to the foot of the y's descender,
 * so the cap line sits 5.4 units below the top. `WORD_PATH` is the four glyphs
 * — U, y, dotless i, z — as one path; `CHEVRON_PATH` is the roof that replaces
 * the i's dot, centred on that stem.
 */
const WORDMARK_VIEWBOX = '0 0 315.45 136.01';

const WORD_PATH =
  'M50.00 107.15Q34.26 107.15 23.10 102.41Q11.95 97.67 5.98 88.27Q0.00 78.87 0.00 65.02V5.11H32.22V64.58Q32.22 72.60 36.59 77.85Q40.96 83.10 49.85 83.10Q58.75 83.10 63.19 77.85Q67.64 72.60 67.64 64.58V5.11H99.85V65.02Q99.85 78.87 93.95 88.27Q88.05 97.67 76.90 102.41Q65.74 107.15 50.00 107.15Z M130.47 136.01Q125.22 136.01 120.85 135.21Q116.47 134.41 113.70 133.39V116.04H125.36Q130.47 116.04 133.16 114.15Q135.86 112.25 136.95 109.77Q138.05 107.30 138.34 105.40L107.73 28.43H138.92L147.96 59.63Q148.69 61.81 149.71 65.46Q150.73 69.10 151.82 72.89Q152.92 76.68 153.64 79.60H154.66Q155.25 77.56 155.90 74.93Q156.56 72.31 157.29 69.47Q158.02 66.62 158.75 64.15Q159.48 61.67 159.91 59.77L168.22 28.43H196.79L169.39 103.07Q166.76 110.21 163.48 116.26Q160.20 122.31 155.76 126.76Q151.31 131.20 145.12 133.61Q138.92 136.01 130.47 136.01Z M202.62 105.40V28.43H231.63V105.40Z M240.38 105.40V95.92L272.74 48.11H242.13V28.43H314.14V37.47L281.49 85.72H315.45V105.40Z';

const CHEVRON_PATH =
  'M217.13,0.00 L199.38,15.03 L199.38,20.40 L207.55,20.40 L217.13,12.88 L226.70,20.40 L234.88,20.40 L234.88,15.03 Z';

/**
 * The blue the chevron wears on the header band.
 *
 * `--color-brand` is #1447e6, which is right on a light page but measures 1.8:1
 * against the band's #0e2a86 — a silhouette rather than a colour. No single
 * token is a usable light blue in both themes (`brand-soft-2` is a 22%-alpha
 * fill in dark, `on-band` reads as white), so the colour is mixed from the two
 * that are solid in both: the brand blue lifted toward `on-band` until it
 * clears the navy. That measures 5.2:1 in light and 8.2:1 in dark, both well
 * past the 3:1 a shape this size needs, and it still reads blue.
 */
const CHEVRON_ON_BAND = 'color-mix(in srgb, var(--color-brand) 45%, var(--color-on-band))';

export const LogoMark: React.FC<{ size?: LogoSize; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const s = SIZES[size];
  return (
    <img
      src="/brand/mark-lockup.png"
      srcSet="/brand/mark-lockup.png 1x, /brand/mark-lockup@2x.png 2x"
      alt=""
      width={76}
      height={96}
      className={`w-auto shrink-0 ${s.mark} ${className}`}
      draggable={false}
    />
  );
};

/** The word on its own, for surfaces that already show the mark. */
export const LogoWordmark: React.FC<{ size?: LogoSize; inverted?: boolean; className?: string }> = ({
  size = 'md',
  inverted = false,
  className = '',
}) => {
  const s = SIZES[size];
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={`w-auto shrink-0 ${s.word} ${className}`}
      role="img"
      aria-label="Uyiz"
      focusable="false"
    >
      {/* currentColor, so the word inherits whatever the surface sets — white
          on the band, `text-content` on a page — with no variant list here. */}
      <path d={WORD_PATH} fill="currentColor" />
      <path
        d={CHEVRON_PATH}
        fill={inverted ? CHEVRON_ON_BAND : 'var(--color-brand)'}
      />
    </svg>
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
        <LogoWordmark
          size={size}
          inverted={inverted}
          className={inverted ? 'text-white' : 'text-content'}
        />
        {tagline && (
          <span
            className={`mt-1 font-semibold uppercase tracking-wide ${s.tagline} ${
              inverted ? 'text-white/70' : 'text-subtle'
            }`}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
};

export default Logo;
