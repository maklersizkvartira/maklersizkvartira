/**
 * A number box for a filter sheet: commits on a pause, not on every keystroke.
 *
 * It lived inside ListingsPage, which was fine while the catalogue was the
 * only screen with a price range. The map has one now, and a second copy of
 * this would have been a second set of answers to the three questions it gets
 * right — when to commit, when to follow the store, and what happens to the
 * last digits when the sheet closes underneath it.
 *
 * `setFilters` fires a list request, so binding one of these straight to the
 * store would put a query on the wire for every digit of "3000000". The
 * store's request sequencing makes that harmless, not free.
 */

import React, { useEffect, useRef, useState } from 'react';

import { TextInput } from './Field';

/** Empty means "no bound", which is not the same number as zero. */
function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Price and area have different ceilings, so the bound travels with the field. */
function clampToRange(value: number | null, max: number): number | null {
  if (value === null) return null;
  return Math.min(Math.max(value, 0), max);
}

export interface NumberFilterProps {
  label: string;
  placeholder: string;
  value: number | null;
  /** The API's own ceiling for this field. Above it the request is a 422. */
  max: number;
  onCommit: (value: number | null) => void;
  step?: number;
}

export const NumberFilter: React.FC<NumberFilterProps> = ({
  label,
  placeholder,
  value,
  max,
  onCommit,
  step,
}) => {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follows the store when it moves on its own — "clear all", a quick filter,
  // a search arriving from the home page — but never while a keystroke of the
  // visitor's is still waiting to be committed.
  useEffect(() => {
    if (timer.current) return;
    setDraft(value === null ? '' : String(value));
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /**
   * Blur is what saves the last digits.
   *
   * These boxes live inside a filter sheet, and `<Sheet>` renders null when it
   * closes — so tapping "Show N results" 200ms after the last keystroke
   * unmounted the field and the cleanup above cancelled the pending commit
   * instead of running it. Pointer-down on the footer button, Escape and a
   * drag dismissal all blur the focused field first, so committing here
   * catches every one of them. The unmount cleanup stays a pure cancel: this
   * component also goes away when the whole page is torn down by a navigation,
   * and firing a filter write plus a list request on the way out of a page the
   * visitor has already left is not a save, it is a leak.
   */
  const flush = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    onCommit(clampToRange(toNumberOrNull(draft), max));
  };

  return (
    <TextInput
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      step={step}
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onBlur={flush}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          onCommit(clampToRange(toNumberOrNull(next), max));
        }, 400);
      }}
    />
  );
};

export default NumberFilter;
