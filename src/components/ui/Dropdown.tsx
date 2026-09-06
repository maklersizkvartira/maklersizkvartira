/**
 * A dropdown the page actually draws.
 *
 * `appearance-none` only ever styled the *closed* control. The list that
 * opens on click is drawn by the operating system — a wheel on iOS, a dialog
 * on Android, a grey menu on Windows — and no CSS a page can write reaches
 * it. So the four dropdowns on the listing form kept looking like someone
 * else's form the moment they were opened, no matter how the box was styled.
 *
 * This replaces the native control with a button and a listbox we render, so
 * the open state is ours too. That is a real cost: everything the browser
 * gave away for free — keyboard navigation, type-ahead, screen-reader
 * semantics, closing on outside click — has to be built back. It is all here,
 * because a dropdown that looks right and cannot be driven from a keyboard is
 * a worse dropdown than the ugly one.
 *
 * The API takes `<option>` and `<optgroup>` children, exactly as a `<select>`
 * does. That is deliberate: every existing call site works unchanged, and the
 * metro field keeps its grouping by line.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

import { cn } from '../../lib/cn';

interface Item {
  value: string;
  label: string;
  disabled?: boolean;
  /** Group heading this item sits under, when the caller used optgroup. */
  group?: string;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** The dense variant used in filter bars and toolbars. */
  compact?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/**
 * The tallest the open list is ever allowed to be.
 *
 * It was `max-h-80` on the element, which is the same number written where the
 * measuring code below cannot see it. Both halves have to agree or the list
 * opens into space it does not fit in.
 */
const MAX_LIST_HEIGHT = 320;

/**
 * The shortest.
 *
 * Without a floor, a control wedged against the bottom of a sheet measures
 * twenty usable pixels and renders a list nothing can be picked out of. Below
 * this the list is allowed to overhang its container and scroll internally
 * instead, which is the better of the two degradations.
 */
const MIN_LIST_HEIGHT = 160;

/** `mt-1`/`mb-1` plus air, so the list never sits flush against the clip. */
const LIST_GAP = 8;

/**
 * The box that actually clips the list, which on a phone is almost never the
 * window.
 *
 * Every one of these dropdowns lives inside the filter Sheet, whose body is
 * `overflow-y-auto` and about 440px tall on a 360x640 phone. Measuring
 * `window.innerHeight` said there was room for all 320px of the list, the sheet
 * then cut two thirds of it off, and the only way to reach the hidden options
 * was to scroll the sheet — which the outside-pointerdown listener reads as a
 * tap outside and answers by closing the list. Tapping 'Tuman' and being unable
 * to pick a district is a large part of "filtrlarni bosganda bug chiqadi".
 *
 * Walking up to the first scrolling or clipping ancestor finds the sheet body
 * when there is one and `#root` (which is `overflow-x: hidden`) when there is
 * not, and clamping to the viewport makes the second case degrade back to the
 * window on its own.
 */
function clipBox(node: HTMLElement | null): { top: number; bottom: number } {
  let element = node?.parentElement ?? null;
  while (element) {
    const { overflowX, overflowY } = getComputedStyle(element);
    if (/auto|scroll|hidden|clip/.test(`${overflowY} ${overflowX}`)) {
      const box = element.getBoundingClientRect();
      return { top: Math.max(box.top, 0), bottom: Math.min(box.bottom, window.innerHeight) };
    }
    element = element.parentElement;
  }
  return { top: 0, bottom: window.innerHeight };
}

/** Flatten `<option>` / `<optgroup>` children into a list we can render. */
function collect(children: React.ReactNode, group?: string): Item[] {
  const items: Item[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    if (child.type === 'optgroup') {
      const props = child.props as { label?: string; children?: React.ReactNode };
      items.push(...collect(props.children, props.label));
      return;
    }
    if (child.type === 'option') {
      const props = child.props as {
        value?: string | number;
        children?: React.ReactNode;
        disabled?: boolean;
      };
      items.push({
        value: String(props.value ?? ''),
        label: String(props.children ?? props.value ?? ''),
        disabled: props.disabled,
        group,
      });
    }
  });
  return items;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  children,
  id,
  invalid = false,
  disabled = false,
  compact = false,
  className = '',
  ...aria
}) => {
  const generatedId = useId();
  const listId = `${generatedId}-list`;
  const buttonId = id ?? `${generatedId}-button`;

  // Walked on every render rather than memoised. `children` is a fresh array
  // each time, so any memo keyed on it would miss anyway — and keying one on a
  // serialised copy of the list costs more than the walk it saves. The longest
  // list in the app is 151 districts.
  const items = collect(children);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(selectedIndex, 0));
  // Opening upwards when there is no room below is the difference between a
  // usable control near the bottom of a form and one whose list is offscreen.
  const [dropUp, setDropUp] = useState(false);
  // How tall the list may actually be here, in pixels. Measured rather than
  // capped by a class, because the room a control has depends on what encloses
  // it, and inside a sheet that is a few hundred pixels, not a viewport.
  const [listMax, setListMax] = useState(MAX_LIST_HEIGHT);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const close = useCallback(() => setOpen(false), []);

  /**
   * Decide which way the list opens and how tall it may be.
   *
   * The old test asked the window two separate questions — "is there less than
   * 320 below" and "is there more than 320 above" — and a control with room for
   * neither answered no to the second, so it opened downwards into the clip
   * anyway. Comparing the two sides against each other flips only when up is
   * genuinely the better side, and the measured cap then makes whichever side
   * was chosen fit: a 272px list of sort options with 204px of room becomes a
   * 204px list that scrolls, instead of six options of which two are reachable.
   */
  const measure = useCallback(() => {
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    if (!rect) return;
    const box = clipBox(root);
    const below = box.bottom - rect.bottom - LIST_GAP;
    const above = rect.top - box.top - LIST_GAP;
    const up = below < Math.min(MAX_LIST_HEIGHT, above);
    setDropUp(up);
    setListMax(Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, up ? above : below)));
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    measure();
    setActive(Math.max(items.findIndex((item) => item.value === value), 0));
    setOpen(true);
  }, [disabled, items, measure, value]);

  const commit = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || item.disabled) return;
      onChange(item.value);
      setOpen(false);
    },
    [items, onChange],
  );

  // Close on any click that is not inside this control.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    // Capture: a click on an element that unmounts itself would otherwise
    // never reach a bubbling listener.
    document.addEventListener('pointerdown', onPointer, true);
    return () => document.removeEventListener('pointerdown', onPointer, true);
  }, [open, close]);

  // A rotation, or the on-screen keyboard opening, moves the box the list was
  // measured against — and it was measured once, at open.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  // Keep the highlighted row in view while arrowing through a long list.
  //
  // Scrolled by hand rather than with `scrollIntoView({ block: 'nearest' })`,
  // which scrolls *every* scroll ancestor: inside the filter sheet, opening a
  // dropdown scrolled the sheet body under the reader's finger, and it did it
  // right after `measure` had recorded where the button was, so the list was
  // then placed against a position the control no longer had.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const node = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !node) return;
    const top = node.offsetTop;
    const bottom = top + node.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [open, active]);

  const step = (delta: number) => {
    setActive((current) => {
      let next = current;
      for (let guard = 0; guard < items.length; guard += 1) {
        next = (next + delta + items.length) % items.length;
        if (!items[next]?.disabled) return next;
      }
      return current;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        // And it stops here. Without this the same press went on to the filter
        // sheet's own document listener, so backing out of an open district
        // list also closed the whole sheet and lost the reader's place in it —
        // layered surfaces are expected to peel one layer per press. The
        // `!open` guard above is what keeps a *closed* dropdown from swallowing
        // the press the sheet is waiting for.
        event.stopPropagation();
        close();
        return;
      case 'ArrowDown':
        event.preventDefault();
        step(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        step(-1);
        return;
      case 'Home':
        event.preventDefault();
        setActive(0);
        return;
      case 'End':
        event.preventDefault();
        setActive(items.length - 1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(active);
        return;
      case 'Tab':
        close();
        return;
      default:
        break;
    }

    // Type-ahead. A native select does this and people rely on it in a list
    // of 150 districts.
    if (event.key.length === 1) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 800 ? event.key : typed.current.text + event.key;
      typed.current.at = now;
      const needle = typed.current.text.toLowerCase();
      const found = items.findIndex(
        (item) => !item.disabled && item.label.toLowerCase().startsWith(needle),
      );
      if (found >= 0) setActive(found);
    }
  };

  // `min-h-11` on both sizes: the compact variant's `py-2` on 12px text is a
  // 32px control, and it is the one that appears in the filter bar — the
  // densest row of taps on the busiest page.
  const size = compact
    ? 'min-h-11 py-2 pl-3 pr-9 text-xs font-bold'
    : 'min-h-11 px-4 py-3 pr-11 text-sm font-medium';
  const border = invalid ? 'border-danger' : open ? 'border-brand' : 'border-line';

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        {...aria}
        className={cn(
          'flex w-full touch-manipulation items-center justify-between gap-2 rounded-xl',
          'border bg-surface-2 text-left text-content transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          open && 'bg-surface',
          border,
          size,
        )}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          // The height comes from `measure`, not from a `max-h-*` class. It
          // used to be `max-h-80`, and a class cannot know that this particular
          // control sits 60px above the bottom of a sheet. It also cannot be
          // both: `cn` merges Tailwind classes against each other, never
          // against an inline style, so a `max-h-80` left here would simply win
          // and cap the list back at 320.
          className={cn(
            'absolute z-50 w-full overscroll-contain overflow-auto rounded-xl',
            'border border-line bg-surface p-1 shadow-2xl',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
          style={{ maxHeight: listMax }}
        >
          {items.map((item, index) => {
            const heading = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const isSelected = item.value === value;
            const isActive = index === active;

            return (
              <React.Fragment key={`${item.group ?? ''}-${item.value}`}>
                {heading && (
                  <li
                    role="presentation"
                    className="px-3 pb-1 pt-2.5 text-[10px] font-black uppercase tracking-wide text-subtle"
                  >
                    {heading}
                  </li>
                )}
                <li
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={item.disabled || undefined}
                  data-active={isActive}
                  // MouseDown prevents focus shift on desktop, keeping keyboard active.
                  // Click actually selects it. This allows touch scrolling on mobile
                  // without accidentally selecting items.
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    commit(index);
                  }}
                  onPointerEnter={() => !item.disabled && setActive(index)}
                  // `min-h-11`: at `py-2` these rows were 36px, and a list of
                  // 151 districts scrolled under a thumb is exactly where an
                  // under-sized target turns into the wrong district.
                  className={cn(
                    'flex min-h-11 cursor-pointer touch-manipulation items-center',
                    'justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    item.disabled && 'cursor-not-allowed opacity-50',
                    isActive && 'bg-surface-3',
                    isSelected ? 'font-bold text-brand-text' : 'text-content',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
