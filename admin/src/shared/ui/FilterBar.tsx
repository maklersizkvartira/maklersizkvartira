'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';

/**
 * Filter controls above a list.
 *
 * Desktop gets one wrapping row. Below sm the whole set collapses behind a
 * single "Filters" button — five selects stacked above a moderation queue push
 * the actual rows off a phone screen, and most sessions never touch them. The
 * count on the toggle is what stops a collapsed panel from hiding a filter
 * someone forgot they set.
 */

interface FilterBarProps {
  /** The controls themselves — Selects, Inputs, whatever the page needs. */
  children: ReactNode;
  /** Always visible on every breakpoint, above the collapse. Usually search. */
  leading?: ReactNode;
  /** How many filters are currently narrowing the list; badges the toggle. */
  activeCount?: number;
  /** Shown as a clear-all button whenever activeCount > 0. */
  onReset?: () => void;
  /** Translated label for the mobile toggle, e.g. "Filtrlar". */
  label: string;
  /** Translated label for the clear-all button, e.g. "Tozalash". */
  resetLabel?: string;
  className?: string;
}

export function FilterBar({
  children,
  leading,
  activeCount = 0,
  onReset,
  label,
  resetLabel,
  className = '',
}: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`mb-4 ${className}`}>
      {leading && <div className="mb-2.5">{leading}</div>}

      {/* ── Mobile: disclosure ── */}
      <div className="sm:hidden">
        <button
          type="button"
          className="filter-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="filter-panel"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={14} />
            {label}
            {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </span>
          <ChevronDown
            size={14}
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          />
        </button>

        {open && (
          <div id="filter-panel" className="filter-panel animate-slide-up">
            {children}
            {activeCount > 0 && onReset && (
              <button type="button" className="filter-toggle justify-center" onClick={onReset}>
                <span className="flex items-center gap-2">
                  <X size={14} /> {resetLabel ?? label}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── sm and up: one row ── */}
      <div className="hidden sm:flex filter-bar">
        {children}
        {activeCount > 0 && onReset && (
          <button
            type="button"
            className="icon-btn flex w-9 h-9"
            onClick={onReset}
            title={resetLabel}
            aria-label={resetLabel ?? label}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
