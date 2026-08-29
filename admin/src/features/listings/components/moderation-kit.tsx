'use client';

import {
  useEffect,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react';

import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Z_DIALOG } from '@/shared/ui/z-layers';

/**
 * Chrome the three moderation screens share.
 *
 * `shared/ui/Modal` cannot serve them, for two reasons that both only bite on a
 * phone — which is where this product is actually moderated from:
 *
 *  · It is a centred card at every width, capped at `100vh - 48px`. A photo
 *    gallery, a risk report, owner details and a note field inside a letterbox
 *    in the middle of a 390px screen is unusable; below sm these are bottom
 *    sheets that own the full height instead.
 *  · It sits at z-index 50 while the mobile glass dock is fixed at 99999, so on
 *    a phone the dock floats on top of the dialog. These sheets sit above it.
 *
 * The file lives under features/listings only because reports and verifications
 * import from it: src/shared/ui belongs to another workstream and is not ours
 * to add to.
 */

/* ─── Touch targets ──────────────────────────────────────────────────────────
   `Select` hardcodes a 36px trigger and `Button` a 36px body, and neither takes
   a responsive size. An arbitrary-variant class outranks their own `h-9` on
   specificity, which is the only way to reach 44px from the outside without
   editing components another workstream owns. */

/** Put on a `<Select>` to give it a 44px trigger on touch widths. */
export const TOUCH_SELECT = '[&>button]:h-11 sm:[&>button]:h-9';

/** Put on any container to give the buttons inside it 44px on touch widths. */
export const TOUCH_BUTTONS = '[&_button]:h-11 sm:[&_button]:h-9';

/** Sheets sit on the shared dialog layer — one above the mobile glass dock's
 *  99999, so a sheet is never covered. See `shared/ui/z-layers`. */
const Z_ABOVE_DOCK = Z_DIALOG;

/* ─── Sheet ──────────────────────────────────────────────────────────────── */

const SHEET_WIDTH = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const;

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Translated, for the close button and the backdrop's accessible name. */
  closeLabel: string;
  /** Desktop width. On a phone every sheet is full-bleed. */
  size?: keyof typeof SHEET_WIDTH;
  footer?: ReactNode;
  children: ReactNode;
}

/** createPortal needs document.body, which does not exist during SSR. */
const subscribeNever = () => () => {};

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  size = 'lg',
  footer,
  children,
}: SheetProps) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Restore whatever was there rather than clearing: a sheet opened from
    // inside a lightbox would otherwise hand scrolling back to the page early.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
      style={{ zIndex: Z_ABOVE_DOCK }}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default"
        style={{ background: 'rgba(5,11,22,0.62)', backdropFilter: 'blur(6px)' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`
          relative w-full ${SHEET_WIDTH[size]} flex flex-col animate-slide-up-mobile
          rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-xl)]
          max-h-[92dvh] sm:max-h-[calc(100dvh-64px)]
        `}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
        }}
      >
        {/* The grab affordance every native sheet has. Decorative — dragging is
            not wired up, so it is hidden from the accessibility tree. */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span
            style={{
              width: 38,
              height: 4,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-border-medium)',
            }}
          />
        </div>

        <div
          className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 sm:pt-5 pb-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="min-w-0">
            <h2
              className="text-base font-bold leading-tight"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="icon-btn flex w-11 h-11 sm:w-8 sm:h-8 shrink-0 -mr-2 sm:mr-0"
          >
            <X size={17} />
          </button>
        </div>

        <div
          className="px-5 sm:px-6 py-4 overflow-y-auto flex-1"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>

        {footer && (
          <div
            className={`
              flex flex-col-reverse gap-2.5 px-5 sm:px-6 pt-3.5 shrink-0
              sm:flex-row sm:items-center sm:justify-end
              [&>button]:w-full sm:[&>button]:w-auto ${TOUCH_BUTTONS}
            `}
            style={{
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              // The dock is gone while a sheet is open, but the home indicator
              // is not — a full-width primary button must clear it.
              paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ─── Lightbox ───────────────────────────────────────────────────────────── */

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  /** Sources to page through. A verification passes one, a listing many. */
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  title?: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
}

/**
 * Full-screen image viewer.
 *
 * Nothing is put in an `<img>` until `open` is true, and the element unmounts
 * when it closes. That is the entire point of this component: a verification
 * document arrives as an ~8 MB base64 data URI, and a browser asked to decode
 * ten of those at once stops responding. The bytes are already in the JSON
 * either way — what this defers is the decode and the paint.
 */
export function Lightbox({
  open,
  onClose,
  images,
  index,
  onIndexChange,
  title,
  closeLabel,
  previousLabel,
  nextLabel,
}: LightboxProps) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const count = images.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && count > 1) onIndexChange((index - 1 + count) % count);
      if (event.key === 'ArrowRight' && count > 1) onIndexChange((index + 1) % count);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, onIndexChange, index, count]);

  if (!open || !mounted || count === 0) return null;

  const src = images[Math.min(Math.max(index, 0), count - 1)];

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: Z_ABOVE_DOCK + 1, background: 'rgba(4,6,12,0.94)' }}
    >
      <div
        className="flex items-center justify-between gap-3 px-3 shrink-0"
        style={{ paddingTop: 'max(10px, env(safe-area-inset-top))', paddingBottom: 10 }}
      >
        <p className="text-sm font-medium truncate pl-2" style={{ color: 'rgba(255,255,255,0.86)' }}>
          {title}
          {count > 1 && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{`  ${index + 1}/${count}`}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="w-11 h-11 flex-center rounded-[var(--radius-full)] shrink-0 active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        >
          <X size={19} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title ?? ''}
          decoding="async"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>

      {count > 1 && (
        <div
          className="flex items-center justify-center gap-4 shrink-0 pt-1"
          style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
        >
          <LightboxStep
            label={previousLabel}
            onClick={() => onIndexChange((index - 1 + count) % count)}
          >
            <ChevronLeft size={20} />
          </LightboxStep>
          <LightboxStep label={nextLabel} onClick={() => onIndexChange((index + 1) % count)}>
            <ChevronRight size={20} />
          </LightboxStep>
        </div>
      )}
    </div>,
    document.body,
  );
}

function LightboxStep({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-12 h-12 flex-center rounded-[var(--radius-full)] active:scale-95 transition-transform"
      style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
    >
      {children}
    </button>
  );
}

/* ─── Thumbnail ──────────────────────────────────────────────────────────── */

interface ThumbProps {
  src?: string | null;
  alt: string;
  /** Square edge in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A fixed-size listing thumbnail.
 *
 * `loading="lazy"` matters more here than it looks: `images` can hold base64
 * data URIs of several megabytes each, so a 24-row grid that decodes every
 * first photo up front freezes the tab. The box is fixed so the row height
 * never depends on what the image turns out to be.
 */
export function Thumb({ src, alt, size = 44, className = '', style }: ThumbProps) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface-3)',
        color: 'var(--color-text-muted)',
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <ImageOff size={Math.round(size * 0.38)} aria-hidden="true" />
      )}
    </span>
  );
}

/* ─── Small pieces ───────────────────────────────────────────────────────── */

/**
 * Risk 0..100 as a chip. The thresholds are the panel's own reading of the
 * score — the backend stores a bare integer and draws no lines in it — so the
 * number is always printed beside the colour rather than replaced by it.
 */
export function RiskPill({ score, label }: { score: number; label: string }) {
  const variant: BadgeVariant = score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'success';
  return <Badge variant={variant} label={`${label} ${score}`} />;
}

/** A titled block inside a sheet. */
export function SheetSection({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-5 last:mb-0 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3
          className="text-[10px] font-bold uppercase tracking-[0.09em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A label/value row, matching the mobile data-card rhythm. */
export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 min-w-0">
      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span
        className="text-sm text-right min-w-0"
        style={{ color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}
      >
        {value}
      </span>
    </div>
  );
}
