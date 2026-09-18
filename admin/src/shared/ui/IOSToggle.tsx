import React from 'react';

interface IOSToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function IOSToggle({ checked, onChange, disabled }: IOSToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="shrink-0"
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? 'var(--accent)' : 'var(--color-surface-4)',
        border: '1px solid var(--color-border)',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.28s ease, box-shadow 0.28s ease',
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
        boxShadow: checked ? '0 0 0 3px var(--accent-subtle)' : 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: checked ? 21 : 1,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(2, 64, 105, 0.3)',
          transition: 'left 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          display: 'block',
        }}
      />
    </button>
  );
}
