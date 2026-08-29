'use client';

import { type ReactNode } from 'react';

import { StatLabel } from './stat-kit';

/**
 * One floor of the page: a small heading, a hairline that runs to the right
 * edge, and the cards beneath it.
 *
 * The heading names the QUESTION the floor answers rather than repeating the
 * title of the card inside it, which is what keeps the rhythm from reading as
 * two labels for one thing. It doubles as a scroll anchor — hence the id and
 * the `scroll-mt`, which clears the 58px fixed header plus a little air, so a
 * jump never lands with the heading tucked under the chrome.
 *
 * The first floor deliberately has no heading: it sits directly under the
 * PageHeader, and a second label there would be noise.
 */

export function Storey({
  id,
  label,
  right,
  children,
}: {
  id: string;
  label: string;
  /** Optional trailing meta — a count, a note. */
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[76px]">
      <div className="mb-3 flex items-center gap-3">
        <StatLabel className="shrink-0">{label}</StatLabel>
        {/* --color-border, not --color-border-light: at 4% alpha the rule was
            invisible against both grounds, which bought the rhythm nothing. */}
        <span
          aria-hidden="true"
          className="h-px flex-1"
          style={{ background: 'var(--color-border)' }}
        />
        {right}
      </div>
      {children}
    </section>
  );
}
