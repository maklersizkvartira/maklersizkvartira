/**
 * The "Uyiz" wordmark, as outlines.
 *
 * A copy of the path data in the public site's `src/components/brand/Logo.tsx`.
 * The two projects deploy separately and share no package, so this is the one
 * place the duplication is unavoidable — if the wordmark is ever redrawn, both
 * files change together.
 *
 * It is a path rather than text on purpose. The panel sets `--font-heading` and
 * the brand name used to be rendered with it, which meant the wordmark was
 * whatever that stack resolved to on a given machine — a different shape in the
 * sidebar from the one on the site. Archivo Black at -0.02em, traced, is the
 * artwork; the chevron over the i is the house's roof and is the only coloured
 * part of the word.
 */

import type { CSSProperties } from 'react';

const VIEWBOX = '0 0 315.45 136.01';

const WORD =
  'M50.00 107.15Q34.26 107.15 23.10 102.41Q11.95 97.67 5.98 88.27Q0.00 78.87 0.00 65.02V5.11H32.22V64.58Q32.22 72.60 36.59 77.85Q40.96 83.10 49.85 83.10Q58.75 83.10 63.19 77.85Q67.64 72.60 67.64 64.58V5.11H99.85V65.02Q99.85 78.87 93.95 88.27Q88.05 97.67 76.90 102.41Q65.74 107.15 50.00 107.15Z M130.47 136.01Q125.22 136.01 120.85 135.21Q116.47 134.41 113.70 133.39V116.04H125.36Q130.47 116.04 133.16 114.15Q135.86 112.25 136.95 109.77Q138.05 107.30 138.34 105.40L107.73 28.43H138.92L147.96 59.63Q148.69 61.81 149.71 65.46Q150.73 69.10 151.82 72.89Q152.92 76.68 153.64 79.60H154.66Q155.25 77.56 155.90 74.93Q156.56 72.31 157.29 69.47Q158.02 66.62 158.75 64.15Q159.48 61.67 159.91 59.77L168.22 28.43H196.79L169.39 103.07Q166.76 110.21 163.48 116.26Q160.20 122.31 155.76 126.76Q151.31 131.20 145.12 133.61Q138.92 136.01 130.47 136.01Z M202.62 105.40V28.43H231.63V105.40Z M240.38 105.40V95.92L272.74 48.11H242.13V28.43H314.14V37.47L281.49 85.72H315.45V105.40Z';

const CHEVRON =
  'M217.13,0.00 L199.38,15.03 L199.38,20.40 L207.55,20.40 L217.13,12.88 L226.70,20.40 L234.88,20.40 L234.88,15.03 Z';

export function Wordmark({
  height = 18,
  className = '',
  style,
}: {
  /** Cap-to-descender height in px; the width follows the artwork. */
  height?: number;
  className?: string;
  /** `color` here paints the word; the chevron keeps the accent. */
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox={VIEWBOX}
      height={height}
      className={className}
      role="img"
      aria-label="Uyiz"
      focusable="false"
      style={{ width: 'auto', display: 'block', ...style }}
    >
      {/* currentColor so the word takes the surface's text colour, the same way
          the heading it replaced did. */}
      <path d={WORD} fill="currentColor" />
      <path d={CHEVRON} fill="var(--color-accent, #1447e6)" />
    </svg>
  );
}

export default Wordmark;
