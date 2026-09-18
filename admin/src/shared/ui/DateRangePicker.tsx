'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  from: string; // 'YYYY-MM-DD' or ''
  to: string;   // 'YYYY-MM-DD' or ''
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYMD(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * Design-system date-range picker — a portal-rendered calendar popover that
 * replaces the browser-native `<input type="date">`. Mirrors the Select
 * component's portal/positioning so it escapes `overflow:hidden` cards and
 * floats above the page. Month/weekday names follow the active locale.
 */
export function DateRangePicker({ from, to, onChange, placeholder, size = 'sm', className = '' }: DateRangePickerProps) {
  const locale = useLocale();
  // The admin catalogue has no `date_picker` namespace; these are the labels
  // SotuvchiAi ships for it, kept inline until a page needs them translated.
  const LABELS: Record<string, string> = {
    placeholder: 'Sana oralig‘i',
    today: 'Bugun',
    last_7_days: 'So‘nggi 7 kun',
    this_month: 'Shu oy',
    clear: 'Tozalash',
    done: 'Tayyor',
  };
  const t = (key: string) => LABELS[key] ?? key;
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const fromD = parseYMD(from);
  const toD = parseYMD(to);

  const [viewMonth, setViewMonth] = useState(() => {
    const base = fromD || toD || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const POP_W = 304;
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const estH = 410; // measured height of a six-row month
    const spaceBelow = vh - rect.bottom - 6;
    const spaceAbove = rect.top - 6;
    // Prefer the side that actually fits; fall back to the roomier one.
    const openBelow = spaceBelow >= estH || spaceBelow >= spaceAbove;
    const available = openBelow ? spaceBelow : spaceAbove;
    let left = rect.left;
    if (left + POP_W > vw - 8) left = vw - POP_W - 8;
    if (left < 8) left = 8;
    setPopStyle({
      position: 'fixed',
      zIndex: 9999,
      left,
      width: POP_W,
      // Short viewports fit neither side, so the popover scrolls rather than
      // pushing the Clear/Done footer past the edge. Floored so it never
      // collapses to a sliver.
      maxHeight: Math.max(available - 8, 200),
      overflowY: 'auto',
      ...(openBelow ? { top: rect.bottom + 6 } : { bottom: vh - rect.top + 6 }),
    });
  }, []);

  const handleOpen = () => {
    if (!open) {
      const base = fromD || toD || new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      updatePosition();
    }
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (triggerRef.current?.contains(tgt)) return;
      if (popRef.current?.contains(tgt)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updatePosition]);

  // 2024-01-01 is a Monday → Monday-first week ordering.
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewMonth),
    [locale, viewMonth],
  );

  const fmtShort = useCallback(
    (d: Date) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(d),
    [locale],
  );

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    return arr;
  }, [viewMonth]);

  const selectDay = (d: Date) => {
    const ymd = toYMD(d);
    if (!fromD || (fromD && toD)) {
      onChange(ymd, ''); // begin a fresh range
    } else if (d < fromD) {
      onChange(ymd, from); // clicked earlier than start → swap so range stays ordered
    } else {
      onChange(from, ymd);
    }
  };

  const today = startOfDay(new Date());
  const presets = [
    { key: 'today', run: () => onChange(toYMD(today), toYMD(today)) },
    { key: 'last_7_days', run: () => onChange(toYMD(addDays(today, -6)), toYMD(today)) },
    { key: 'this_month', run: () => onChange(toYMD(new Date(today.getFullYear(), today.getMonth(), 1)), toYMD(today)) },
  ];

  const triggerLabel = fromD
    ? toD
      ? `${fmtShort(fromD)} – ${fmtShort(toD)}`
      : `${fmtShort(fromD)} – …`
    : (placeholder ?? t('placeholder'));

  const heights = size === 'sm' ? 'h-8 text-xs' : 'h-[42px] text-sm';
  const hasValue = !!(fromD || toD);
  const todayYMD = toYMD(today);

  const popover = open ? (
    <div
      ref={popRef}
      style={{
        ...popStyle,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-dropdown)',
        borderRadius: 'var(--radius-lg)',
        padding: 12,
        animation: 'fade-in-dropdown 0.15s ease',
      }}
    >
      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={p.run}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-2)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            {t(p.key)}
          </button>
        ))}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold capitalize" style={{ color: 'var(--color-text-primary)' }}>{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-2)]"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((w, i) => (
          <div key={i} className="h-7 flex items-center justify-center text-[10px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ymd = toYMD(d);
          const isStart = !!fromD && ymd === from;
          const isEnd = !!toD && ymd === to;
          const inRange = !!fromD && !!toD && d > fromD && d < toD;
          const selected = isStart || isEnd;
          const isToday = ymd === todayYMD;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => selectDay(d)}
              className="h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors relative"
              style={
                selected
                  ? { background: 'var(--accent)', color: '#fff' }
                  : inRange
                    ? { background: 'var(--accent-subtle)', color: 'var(--accent)' }
                    : { color: 'var(--color-text-secondary)' }
              }
              onMouseEnter={(e) => { if (!selected && !inRange) e.currentTarget.style.background = 'var(--color-surface-2)'; }}
              onMouseLeave={(e) => { if (!selected && !inRange) e.currentTarget.style.background = 'transparent'; }}
            >
              {d.getDate()}
              {isToday && !selected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          {t('done')}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-2 px-3 ${heights} rounded-[var(--radius-md)] border-[1.5px] transition-all duration-150 outline-none w-full ${
          open
            ? 'bg-[var(--color-surface)] border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-subtle)]'
            : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-medium)]'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon size={14} style={{ color: hasValue ? 'var(--accent)' : 'var(--color-text-muted)', flexShrink: 0 }} />
        <span className="truncate flex-1 text-left" style={{ color: hasValue ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
          {triggerLabel}
        </span>
        {hasValue && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear dates"
            onClick={(e) => { e.stopPropagation(); onChange('', ''); }}
            className="flex items-center justify-center rounded transition-colors hover:text-[var(--color-danger)] p-2 -mr-2"
            style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
