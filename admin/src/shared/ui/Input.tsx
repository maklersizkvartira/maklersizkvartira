'use client';

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, type ReactNode } from 'react';

/* ─── Input ──────────────────────────────────────────────────────────────────── */

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, startIcon, endIcon, fullWidth, className = '', style, ...props }, ref) => {
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
        <div
          className={`input-wrapper flex items-center gap-2 rounded-[var(--radius-md)] transition-all ${
            error ? 'border-danger error-glow' : ''
          }`}
          style={{
            padding: startIcon || endIcon ? '0 12px' : undefined,
          }}
        >
          {startIcon && (
            <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
              {startIcon}
            </span>
          )}
          <input
            ref={ref}
            className={`input-field ${startIcon || endIcon ? 'border-0 bg-transparent shadow-none px-0' : ''} ${className}`}
            style={{
              ...(startIcon || endIcon ? { height: '44px', flex: 1, minWidth: 0, border: 'none', boxShadow: 'none', padding: '0', outline: 'none' } : {}),
              ...style,
            }}
            {...props}
          />
          {endIcon && (
            <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
              {endIcon}
            </span>
          )}
        </div>
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
