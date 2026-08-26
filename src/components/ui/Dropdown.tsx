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

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const close = useCallback(() => setOpen(false), []);

  const openList = useCallback(() => {
    if (disabled) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 260 && rect.top > 260);
    setActive(Math.max(items.findIndex((item) => item.value === value), 0));
    setOpen(true);
  }, [disabled, items, value]);

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

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest' });
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

  const size = compact
    ? 'py-2 pl-3 pr-9 text-xs font-bold'
    : 'px-4 py-3 pr-11 text-sm font-medium';
  const border = invalid ? 'border-danger' : open ? 'border-brand' : 'border-line';

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
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
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-surface-2
          text-left text-content transition-colors
          disabled:cursor-not-allowed disabled:opacity-60
          ${open ? 'bg-surface' : ''} ${border} ${size}`}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-subtle transition-transform ${open ? 'rotate-180' : ''}`}
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
          className={`absolute z-50 max-h-64 w-full overflow-auto rounded-xl border border-line
            bg-surface p-1 shadow-2xl ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
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
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2
                    text-sm transition-colors
                    ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}
                    ${isActive ? 'bg-surface-3' : ''}
                    ${isSelected ? 'font-bold text-brand-text' : 'text-content'}`}
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
