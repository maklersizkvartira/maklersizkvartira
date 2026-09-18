'use client';

/**
 * The pieces both desks are built from — SotuvchiAi's conversations page,
 * taken apart so the support thread and the AI thread draw the same list
 * item, the same dotted canvas, the same bubbles and the same glowing
 * composer. The styles are the `.conv-*`, `.chat-input-wrapper` and
 * `.btn-send-msg` rules in globals.css.
 */

import React, { useCallback, useRef, useState } from 'react';
import { MessageSquare, Search, Send } from 'lucide-react';

import { useTheme } from '@/providers';
import { Spinner } from '@/shared/ui/Spinner';
import { cn } from '@/shared/lib/cn';

/* ─── Canvas ─────────────────────────────────────────────────────────────── */

/** The dotted, aurora-lit background behind a thread. */
export function ChatBg() {
  const { theme } = useTheme();
  const dot = theme === 'dark' ? 'rgba(148,197,235,0.06)' : 'rgba(14,165,233,0.07)';
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${dot} 1.4px, transparent 1.4px)`,
          backgroundSize: '22px 22px',
          backgroundPosition: 'center',
          maskImage: 'radial-gradient(ellipse 120% 80% at 50% 0%, #000 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 120% 80% at 50% 0%, #000 55%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-14%',
          right: '-8%',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.12) 0%, transparent 68%)',
          filter: 'blur(6px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-16%',
          left: '-10%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(var(--accent-light-rgb), 0.10) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ─── List side ──────────────────────────────────────────────────────────── */

export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <div className="conv-search">
      <Search size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

/** The sliding-thumb segmented control under the search. */
export function GlassTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === value));
  return (
    <div className="apple-glass-tabs" style={{ width: '100%', marginTop: 10 }} role="tablist">
      <div
        className="apple-glass-tab-thumb"
        style={{
          width: `calc((100% - 6px) / ${tabs.length})`,
          transform: `translateX(${index * 100}%)`,
          transition: 'transform 0.52s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}
      />
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 28,
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              transition: 'color 0.3s',
              zIndex: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              pointerEvents: active ? 'none' : 'auto',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 4px',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ListEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px' }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          margin: '0 auto 12px',
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        <MessageSquare size={20} />
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', margin: 0 }}>{title}</p>
      {hint && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export function ListLoading({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spinner label={label} />
    </div>
  );
}

/** Inline error under a polling list — a toast per tick would bury the panel. */
export function ListError({ message, retry, onRetry }: { message: string; retry: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <p style={{ fontSize: 12, color: 'var(--color-danger)', margin: 0 }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {retry}
      </button>
    </div>
  );
}

/** Round initials avatar with an optional status dot — the list item's mark. */
export function DeskAvatar({
  name,
  src,
  size = 44,
  dot,
}: {
  name: string;
  src?: string | null;
  size?: number;
  dot?: 'success' | 'muted' | 'accent' | null;
}) {
  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  const dotColor =
    dot === 'success' ? 'var(--color-success)' : dot === 'accent' ? 'var(--accent)' : dot === 'muted' ? 'var(--color-text-muted)' : null;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--color-surface-3) 100%)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size >= 40 ? 13 : 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {initials}
        </div>
      )}
      {dotColor && (
        <span
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid var(--color-surface)',
            background: dotColor,
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

/* ─── Thread side ────────────────────────────────────────────────────────── */

export function ThreadEmpty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: 'var(--bg)',
        textAlign: 'center',
        padding: 40,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)',
          color: 'var(--accent)',
        }}
      >
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', margin: '0 0 8px', fontFamily: 'var(--font-heading)' }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, maxWidth: 280, margin: 0 }}>{hint}</p>
      </div>
    </div>
  );
}

export type BubbleSide = 'user' | 'ai' | 'operator';

/**
 * One message. Visitors sit left in a frosted surface bubble; the AI and
 * the operator sit right, blue and green respectively, with the role label
 * above and the time below — SotuvchiAi's transcript exactly.
 */
export function MessageBubble({
  side,
  label,
  labelIcon,
  avatar,
  time,
  children,
}: {
  side: BubbleSide;
  /** Role label above the bubble (AI / operator name). */
  label?: string | null;
  labelIcon?: React.ReactNode;
  /** Left-side avatar for a visitor; the right side draws its own. */
  avatar?: React.ReactNode;
  time: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isUser = side === 'user';
  const isRight = !isUser;
  const labelColor = side === 'ai' ? 'var(--accent)' : 'var(--color-success)';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isRight ? 'flex-end' : 'flex-start',
        marginBottom: 8,
        animation: 'msgFadeIn 0.22s ease both',
      }}
    >
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, marginRight: isRight ? 36 : 0, marginLeft: isRight ? 0 : 36 }}>
          {labelIcon && (
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: labelColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              {labelIcon}
            </div>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '78%' }}>
        {isUser && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatar ?? (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                }}
              >
                <PersonGlyph />
              </div>
            )}
          </div>
        )}

        <div
          className="conv-msg-bubble"
          style={{
            padding: '9px 13px',
            borderRadius: isUser ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
            background: isUser
              ? isDark
                ? 'rgba(255,255,255,0.13)'
                : 'rgba(255,255,255,0.9)'
              : side === 'operator'
                ? 'linear-gradient(160deg, #10b981 0%, #047a52 100%)'
                : 'linear-gradient(160deg, var(--accent) 0%, var(--accent-dark) 100%)',
            border: isUser ? `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)'}` : 'none',
            backdropFilter: isUser ? 'blur(12px)' : 'none',
            WebkitBackdropFilter: isUser ? 'blur(12px)' : 'none',
            boxShadow: 'var(--shadow-message-out)',
            color: isUser ? (isDark ? '#fff' : '#09090d') : '#fff',
            fontSize: 14,
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{children}</p>
        </div>

        {isRight && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              flexShrink: 0,
              background: side === 'ai' ? 'var(--accent)' : 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: side === 'ai' ? '0 2px 8px var(--accent-glow)' : 'none',
            }}
          >
            {side === 'ai' ? <SparkGlyph /> : <PersonGlyph strokeWidth={2.5} />}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: textMuted, marginTop: 3, marginLeft: isRight ? 0 : 36, marginRight: isRight ? 36 : 0 }}>{time}</div>
    </div>
  );
}

export function PersonGlyph({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function SparkGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

/* ─── Composer ───────────────────────────────────────────────────────────── */

type TypingSpeed = 'none' | 'slow' | 'normal' | 'fast';

/**
 * The frosted pill composer whose border chases the cursor as fast as the
 * operator types. Enter sends, Shift+Enter breaks a line, the box grows to
 * four rows. `disabledReason` swaps the placeholder so a dead box explains
 * itself instead of reading as a bug.
 */
export function Composer({
  value,
  onChange,
  onSend,
  placeholder,
  sending,
  disabled,
  disabledReason,
  sendLabel,
  above,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  placeholder: string;
  sending: boolean;
  disabled?: boolean;
  disabledReason?: string;
  sendLabel: string;
  /** Quick replies or a notice, drawn over the fade above the pill. */
  above?: React.ReactNode;
}) {
  const [rows, setRows] = useState(1);
  const [speed, setSpeed] = useState<TypingSpeed>('none');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastKeyRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = useTheme();

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value;
      onChange(next);
      setRows(Math.min(4, Math.max(1, next.split('\n').length)));

      const now = Date.now();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (next.trim() === '') {
        setSpeed('none');
        lastKeyRef.current = 0;
        return;
      }
      if (lastKeyRef.current > 0) {
        const gap = now - lastKeyRef.current;
        setSpeed(gap < 150 ? 'fast' : gap < 350 ? 'normal' : 'slow');
      } else {
        setSpeed('normal');
      }
      lastKeyRef.current = now;
      timeoutRef.current = setTimeout(() => {
        setSpeed('none');
        lastKeyRef.current = 0;
      }, 1000);
    },
    [onChange],
  );

  const canSend = !disabled && !sending && value.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend();
    setRows(1);
    setSpeed('none');
    textareaRef.current?.focus();
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        padding: '10px 12px 14px',
        background:
          theme === 'dark'
            ? 'linear-gradient(to top, rgba(7,26,44,0.85) 30%, transparent 100%)'
            : 'linear-gradient(to top, var(--bg) 30%, transparent 100%)',
      }}
    >
      {above && <div style={{ marginBottom: 8 }}>{above}</div>}
      <div className={cn('chat-input-wrapper', `typing-${disabled ? 'none' : speed}`, disabled && 'is-disabled')}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={rows}
          disabled={disabled}
          placeholder={disabled && disabledReason ? disabledReason : placeholder}
          aria-label={placeholder}
        />
        <button type="button" onClick={send} disabled={!canSend} aria-label={sendLabel} className={cn('btn-send-msg', canSend && 'active')}>
          <span className="btn-send-msg-inner">{sending ? <Spinner size="sm" label={sendLabel} /> : <Send size={15} aria-hidden="true" />}</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Header helpers ─────────────────────────────────────────────────────── */

/** The small tinted status pill under the name in the chat header. */
export function HeaderStatus({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'warning' | 'muted' | 'accent';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const color =
    tone === 'success' ? 'var(--color-success)' : tone === 'warning' ? '#f59e0b' : tone === 'accent' ? 'var(--accent)' : 'var(--color-text-muted)';
  const bg =
    tone === 'success'
      ? 'rgba(16,185,129,0.12)'
      : tone === 'warning'
        ? 'rgba(245,158,11,0.12)'
        : tone === 'accent'
          ? 'var(--accent-subtle)'
          : theme === 'dark'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, padding: '2px 8px 2px 6px', borderRadius: 9999, background: bg, maxWidth: '100%' }}>
      {icon && <span style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    </div>
  );
}

/** The count chip beside a list heading. */
export function CountChip({ value }: { value: number }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        minWidth: 18,
        height: 18,
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-surface-3)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 5px',
        boxSizing: 'border-box',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      {value}
    </span>
  );
}

/** The unread badge on a list row. */
export function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: '50%',
        background: '#2b86c5',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

export function formatClock(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
