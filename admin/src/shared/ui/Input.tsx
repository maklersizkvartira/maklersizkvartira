'use client';

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, type ReactNode, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/* ─── Input ──────────────────────────────────────────────────────────────────── */

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
  /** When true on a `type="password"` field, renders an eye toggle to reveal/hide the value. */
  revealable?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, startIcon, endIcon, fullWidth, revealable, type, className = '', style, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const canReveal = !!revealable && type === 'password';
    const effectiveType = canReveal && revealed ? 'text' : type;

    // The reveal toggle takes precedence over a supplied endIcon for password fields.
    const trailing = canReveal ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? 'Hide value' : 'Show value'}
        className="flex-shrink-0 flex items-center justify-center rounded-md transition-colors hover:text-[var(--color-text-secondary)]"
        style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}
      >
        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    ) : endIcon ? (
      <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
        {endIcon}
      </span>
    ) : null;

    const hasIcon = !!(startIcon || trailing);
    return (
      <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            className="text-sm font-medium"
            style={{ color: error ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}
        {hasIcon ? (
          <div
            className={`input-wrapper flex items-center gap-2 rounded-[var(--radius-md)] transition-all ${
              error ? 'border-danger error-glow' : ''
            }`}
            style={{
              padding: '0 12px',
            }}
          >
            {startIcon && (
              <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
                {startIcon}
              </span>
            )}
            <input
              ref={ref}
              type={effectiveType}
              className={`input-field border-0 bg-transparent shadow-none px-0 ${className}`}
              style={{
                height: '40px',
                flex: 1,
                minWidth: 0,
                border: 'none',
                boxShadow: 'none',
                padding: '0',
                outline: 'none',
                ...style,
              }}
              {...props}
            />
            {trailing}
          </div>
        ) : (
          <input
            ref={ref}
            type={effectiveType}
            className={`input-field ${error ? 'border-danger error-glow' : ''} ${className}`}
            style={style}
            {...props}
          />
        )}
        {error && (
          <p className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

/* ─── Textarea ───────────────────────────────────────────────────────────────── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth, className = '', ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className="text-sm font-medium" style={{ color: error ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`input-field resize-none ${className}`}
          style={{
            height: 'auto',
            minHeight: '88px',
            padding: '10px 14px',
            borderColor: error ? 'var(--color-danger)' : undefined,
            boxShadow: error ? '0 0 0 3px rgba(239,68,68,0.1)' : undefined,
          }}
          {...props}
        />
        {error && (
          <p className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
