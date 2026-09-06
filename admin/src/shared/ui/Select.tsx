'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

import { useEscapeToClose } from './escape-layer';
import { Z_DIALOG_POPOVER } from './z-layers';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  size = 'md',
  id,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * The option list, so opening can put focus in it.
   *
   * Without this the control was not operable by keyboard at all: every option
   * committed its value from `onMouseDown` and nothing else — no `onClick`, no
   * key handler — so Enter and Space on a focused option did nothing. And the
   * list portals to `document.body`, so it is the LAST thing in the document:
   * a Tab from the trigger did not reach it, it went to whatever followed the
   * trigger in the page. There was no sequence of keys that could change a
   * value here.
   */
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const selectId = id ?? uid;

  const selected = options.find((o) => o.value === value);
  /**
   * Whether the trigger should say what this filter IS rather than what it is
   * set to.
   *
   * Every filter row in the panel passes a `placeholder` naming its field —
   * "Holat", "Tuman", "Eng kam risk" — and every one of them also carries a
   * `{ value: '', label: 'Barchasi' }` option for the unfiltered state. So the
   * placeholder was dead code in all of them: `selected` was always found, its
   * label always won, and a filter row rendered as four identical unlabelled
   * "Barchasi" pills with nothing to say which was which.
   *
   * An empty value is the neutral state everywhere in this panel, so when it
   * is the one selected and the caller has said what the field is, the field's
   * name is the more useful of the two. The option itself keeps its own label
   * inside the open list, where it reads as a choice rather than a heading.
   */
  const showPlaceholder = !selected || (selected.value === '' && Boolean(placeholder));

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const dropdownHeight = Math.min(options.length * 40 + 8, 280);
    const openBelow = spaceBelow >= dropdownHeight || spaceBelow > rect.top;
    // The side we picked also has to cap the height. The 280px above only ever
    // chose a side: the list itself was then painted at its natural height, so
    // an 8-option status filter opened from the lower half of a phone ran off
    // the bottom of the viewport, and because the list is `position: fixed` the
    // page behind it cannot be scrolled to the options that fell off. The last
    // two statuses were simply not selectable. 160px keeps four rows visible
    // even in a cramped spot; the 12px is the 6px gap plus a little breathing
    // room at the viewport edge.
    const availableSpace = openBelow ? spaceBelow : rect.top;

    // The list is at least 160px wide whatever the trigger is, so a Select that
    // has been squeezed narrow near the right-hand edge of a row used to open
    // partly off-screen — and being `position: fixed`, nothing could scroll it
    // back. Pinned to the viewport with the same 8px it keeps everywhere else.
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setDropdownStyle({
      position: 'fixed',
      // The dropdown portals to body, so it has to clear the tallest thing it
      // can be opened from — a modal or a moderation sheet, both of which sit
      // above the mobile dock. See `z-layers`.
      zIndex: Z_DIALOG_POPOVER,
      left,
      width,
      maxHeight: Math.max(160, availableSpace - 12),
      ...(openBelow
        ? { top: rect.bottom + 6 }
        : { bottom: viewportHeight - rect.top + 6 }),
    });
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    if (!open) {
      updateDropdownPosition();
    }
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Check if click is inside the portal dropdown
        const portal = document.getElementById(`select-portal-${selectId.replace(/:/g, '')}`);
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, selectId]);

  // Close on Escape, and give the keyboard back to the trigger it came from.
  //
  // Through the shared stack: an open list inside a moderation sheet is the
  // topmost layer, so the press closes the list and leaves the sheet standing.
  // Bound on `document` directly, both would have closed on one press.
  useEscapeToClose(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  // Opening moves focus into the list, onto the current value. This is what
  // makes the arrow keys below reachable at all — the list is portalled to the
  // end of the body, so nothing would otherwise ever tab into it.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const current = list.querySelector<HTMLButtonElement>('button[aria-selected="true"]');
    (current ?? items[0])?.focus();
  }, [open]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updateDropdownPosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updateDropdownPosition]);

  const heights = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';

  const commit = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  /** Arrow keys move focus inside the list; Tab closes it rather than escaping
   *  into whatever happens to follow the portal at the end of the body. */
  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(
      list.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = index < 0 ? 0 : (index + step + items.length) % items.length;
      items[next].focus();
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1].focus();
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const dropdownEl = open ? (
    <div
      ref={listRef}
      id={`select-portal-${selectId.replace(/:/g, '')}`}
      role="listbox"
      onKeyDown={onListKeyDown}
      style={{
        ...dropdownStyle,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-dropdown)',
        borderRadius: 'var(--radius-lg)',
        padding: '4px 0',
        // `auto`, not `hidden`: with a `maxHeight` now set, `hidden` would
        // clip the overflowing options away instead of letting the admin
        // reach them. `contain` keeps the flick that scrolls the list from
        // chaining into the page — or into the dialog — behind it.
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        animation: 'fade-in-dropdown 0.15s ease',
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={opt.disabled}
            // Both. `onMouseDown` is what makes a pointer selection survive
            // the outside-click handler that would otherwise close the list
            // first; `onClick` is what a keyboard Enter or Space fires on a
            // <button>, and it was missing — which is why this control could
            // not be operated by keyboard at all.
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commit(opt);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              commit(opt);
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-all"
            style={{
              // A finger needs 44px. The panel's touch-target rule is written
              // as a direct-child selector, and this list is portalled to the
              // body, so it never reached these rows — the one part of the
              // control an admin on a phone actually taps.
              minHeight: 'var(--select-option-min-h, 36px)',
              background: isSelected ? 'var(--color-info-bg)' : 'transparent',
              color: opt.disabled
                ? 'var(--color-text-muted)'
                : isSelected
                  ? 'var(--color-brand-600)'
                  : 'var(--color-text-primary)',
              fontWeight: isSelected ? 600 : 400,
              opacity: opt.disabled ? 0.45 : 1,
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isSelected && !opt.disabled) {
                e.currentTarget.style.background = 'var(--color-surface-2)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isSelected ? 'var(--color-info-bg)' : 'transparent';
            }}
          >
            <span>{opt.label}</span>
            {isSelected && (
              <Check size={13} style={{ color: 'var(--color-brand-500)', flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`} id={selectId}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`
          w-full flex items-center justify-between gap-2 px-3 ${heights}
          font-medium rounded-[var(--radius-md)]
          transition-all duration-150 outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        style={{
          background: 'var(--color-surface)',
          border: `1.5px solid ${open ? 'var(--color-brand-500)' : 'var(--color-border)'}`,
          color: showPlaceholder ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          boxShadow: open ? '0 0 0 3px var(--color-info-border)' : 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{showPlaceholder ? placeholder : selected?.label}</span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Portal dropdown — renders outside all overflow containers */}
      {typeof document !== 'undefined' && dropdownEl
        ? createPortal(dropdownEl, document.body)
        : null}
    </div>
  );
}
