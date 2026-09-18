import { Wordmark } from './Wordmark';

/**
 * Brand loading screen — the "Uyiz" lockup assembles itself: the wordmark
 * drops in from the top, the accent dot pops after it and the "ADMIN" line
 * rises from below. A thin indeterminate bar glides underneath. No
 * pulsing/blinking; motion is disabled under prefers-reduced-motion.
 *
 * Optional `message` / `action` slots let DashboardLayout turn the splash into
 * the one control that can get the admin out of a dead API (retry).
 */
export function BrandLoader({
  fullscreen = true,
  message,
  action,
}: {
  fullscreen?: boolean;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden'
          : 'flex min-h-[65vh] w-full items-center justify-center overflow-hidden'
      }
      style={fullscreen ? { background: 'var(--bg)' } : undefined}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(56% 44% at 50% 42%, rgba(var(--accent-rgb), 0.10), transparent 72%)' }}
      />

      <div className="relative flex flex-col items-center gap-8">
        <div className="brand-loader-mark" aria-label="Uyiz Admin">
          <span className="blm blm-top">
            <Wordmark height={44} style={{ color: 'var(--color-text-primary)' }} />
          </span>
          <span className="blm blm-dot">.</span>
          {/* Left untranslated on purpose: this line is the second half of the
              wordmark lockup, not prose. */}
          <span className="blm blm-bottom brand-loader-sub">ADMIN</span>
        </div>

        {message ? (
          <p className="text-sm text-center max-w-[280px] -mt-3" style={{ color: 'var(--color-text-muted)' }}>
            {message}
          </p>
        ) : null}

        {action ?? <div className="brand-loader-track"><span className="brand-loader-fill" /></div>}
      </div>

      <style>{`
        .brand-loader-mark {
          display: inline-flex;
          align-items: baseline;
          gap: 2px;
          font-family: var(--font-heading, inherit);
          font-weight: 800;
          letter-spacing: -0.045em;
          font-size: clamp(36px, 9vw, 58px);
          color: var(--color-text-primary);
          white-space: nowrap;
        }
        .brand-loader-sub {
          margin-left: 10px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.28em;
          color: var(--color-text-muted);
        }
        .blm {
          display: inline-block;
          opacity: 0;
          animation-duration: 0.75s;
          animation-timing-function: cubic-bezier(0.2, 0.9, 0.25, 1);
          animation-fill-mode: both;
        }
        .blm-top    { animation-name: blm-top;    animation-delay: 0.05s; }
        .blm-bottom { animation-name: blm-bottom; animation-delay: 0.29s; }
        .blm-dot    { animation-name: blm-dot;    animation-delay: 0.42s; color: var(--accent); }

        @keyframes blm-top    { from { opacity: 0; transform: translateY(-46px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blm-bottom { from { opacity: 0; transform: translateY(46px); }  to { opacity: 1; transform: translateY(0); } }
        @keyframes blm-dot    { from { opacity: 0; transform: scale(0.2); }         to { opacity: 1; transform: scale(1); } }

        .brand-loader-track {
          position: relative;
          width: 172px; height: 3px;
          border-radius: 999px;
          background: var(--color-surface-2);
          overflow: hidden;
        }
        .brand-loader-fill {
          position: absolute; top: 0; left: 0;
          height: 100%; width: 42%;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          animation: brand-loader-slide 1.25s ease-in-out infinite;
        }
        @keyframes brand-loader-slide {
          0%   { transform: translateX(-130%); }
          100% { transform: translateX(360%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .blm { animation: none; opacity: 1; transform: none; }
          .brand-loader-fill { animation: none; width: 100%; }
        }
      `}</style>
    </div>
  );
}
