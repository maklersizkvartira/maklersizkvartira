'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

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
  const uid = useId();
  const selectId = id ?? uid;

  const selected = options.find((o) => o.value === value);

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const dropdownHeight = Math.min(options.length * 40 + 8, 280);
    const openBelow = spaceBelow >= dropdownHeight || spaceBelow > rect.top;

    setDropdownStyle({
      position: 'fixed',
      // The dropdown portals to body, so it has to clear the tallest thing it
      // can be opened from — a modal or a moderation sheet, both of which sit
      // above the mobile dock. See `z-layers`.
      zIndex: Z_DIALOG_POPOVER,
      left: rect.left,
      width: Math.max(rect.width, 160),
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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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

  const dropdownEl = open ? (
    <div
      id={`select-portal-${selectId.replace(/:/g, '')}`}
      role="listbox"
      style={{
        ...dropdownStyle,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-dropdown)',
        borderRadius: 'var(--radius-lg)',
        padding: '4px 0',
        overflow: 'hidden',
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
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!opt.disabled) {
                onChange(opt.value);
                setOpen(false);
              }
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-all"
            style={{
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
          color: selected ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          boxShadow: open ? '0 0 0 3px var(--color-info-border)' : 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
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
