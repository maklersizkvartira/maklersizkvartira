/**
 * The thank-you shown once, after a registration completes.
 *
 * The old ending was a checkmark inside the auth dialog that vanished after
 * 1.8 seconds — long enough to notice something happened, too short to read,
 * and with nothing on it that said whose product they had just joined.
 *
 * This is deliberately slow. Each piece arrives in turn — ring, mark,
 * wordmark, message — so the eye follows one thing at a time instead of a
 * finished screen appearing at once. Roughly two seconds to assemble, then it
 * holds while the line is read.
 *
 * It closes on its own, on a click anywhere, and on Escape. Nobody should be
 * trapped by a congratulation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '../../i18n';
import { LogoMark, LogoWordmark } from '../brand/Logo';

interface WelcomeCelebrationProps {
  name: string;
  onDone: () => void;
}

/** How long the whole thing stays up, assembly included. */
const HOLD_MS = 5200;
/** Must match the duration of `animate-welcome-out`. */
const EXIT_MS = 420;

export const WelcomeCelebration: React.FC<WelcomeCelebrationProps> = ({ name, onDone }) => {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  // Guards against a second exit: the timer and a click can race, and running
  // onDone twice would close whatever the caller opened next.
  const finished = useRef(false);

  const dismiss = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    window.setTimeout(onDone, EXIT_MS);
  }, [onDone]);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, HOLD_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll while this is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [dismiss]);

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-body"
      onClick={dismiss}
      className={`welcome-overlay fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md
        ${leaving ? 'animate-welcome-out' : 'animate-welcome-in'}`}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface p-8 text-center shadow-2xl"
      >
        {/* A soft brand wash behind the mark, so the panel is not a flat box. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl"
        />

        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden="true"
            className="animate-welcome-ring absolute inset-0 rounded-full border-2 border-brand/40"
          />
          <span className="animate-welcome-mark relative">
            <LogoMark size="xl" />
          </span>
        </div>

        {/* The real wordmark, not a hand-set copy of it. This used to be two
            coloured spans typed out here, which drifted from Logo.tsx twice —
            once with the colours reversed — and showed a different wordmark
            from every other surface. There is one definition now. */}
        <LogoWordmark size="xl" className="animate-welcome-step-1 mt-5 text-content" />

        <h2
          id="welcome-title"
          className="animate-welcome-step-2 mt-4 text-lg font-black text-content"
        >
          {t('auth.success.welcomeTitle', { name })}
        </h2>

        <p
          id="welcome-body"
          className="animate-welcome-step-3 mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted"
        >
          {t('auth.success.welcomeThanks')}
        </p>

        <div className="animate-welcome-step-3 mx-auto mt-6 h-1 w-full max-w-[12rem] overflow-hidden rounded-full bg-surface-3">
          <span className="animate-welcome-progress block h-full rounded-full bg-brand" />
        </div>

        <p className="animate-welcome-step-3 mt-3 text-[11px] font-semibold text-subtle">
          {t('auth.success.welcomeDismiss')}
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default WelcomeCelebration;
