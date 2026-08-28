'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { Z_DIALOG } from './z-layers';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  /** Accessible name of the ✕. English is the fallback, not the intent. */
  closeLabel?: string;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/** The client-ness of the page never changes, so there is nothing to notify. */
const subscribeNever = () => () => {};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  footer,
  closeLabel = 'Close',
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // createPortal needs document.body, which does not exist during the server
  // render. useSyncExternalStore is the SSR-safe way to ask "am I on the
  // client yet": false on the server and in the hydrating pass, true after —
  // no state to set from an effect, and no hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: Z_DIALOG }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5,11,22,0.6)', backdropFilter: 'blur(6px)' }}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${sizeMap[size]} animate-scale-in`}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          // dvh, not vh: on a phone `100vh` is the LARGE viewport, so a tall
          // panel runs under the browser's own toolbar and its footer buttons
          // are unreachable.
          maxHeight: 'calc(100dvh - 48px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Gradient top accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'var(--gradient-brand)',
          }}
        />

        {/* Header */}
        {title && (
          <div
            className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div className="pr-4">
              <h2
                className="text-base font-bold"
                style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex-center rounded-[var(--radius-md)] transition-all flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-2)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
              aria-label={closeLabel}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
