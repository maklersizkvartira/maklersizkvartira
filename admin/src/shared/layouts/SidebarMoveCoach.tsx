'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Grab, MoveHorizontal, MoveVertical, Check, RotateCcw, X } from 'lucide-react';
import { useUIStore } from '@/store/ui.store';
import { useMounted } from './useMounted';

interface Rect { top: number; left: number; width: number; height: number; }
type Step = 'sidebar' | 'sidebar-done' | 'header' | 'header-done' | 'confirm';

/**
 * Interactive layout tour launched from the Appearance panel. It walks the user
 * through repositioning the **real** sidebar and header: the overlay is
 * click-through (pointer-events: none) so the actual drag gesture works, and it
 * advances only once the user completes each reposition (watched via the store),
 * showing a "Good!" beat between steps and a keep/reset choice at the end.
 */
export function SidebarMoveCoach() {
  const open = useUIStore((s) => s.sidebarCoachOpen);
  const setOpen = useUIStore((s) => s.setSidebarCoachOpen);
  const setSidebarPosition = useUIStore((s) => s.setSidebarPosition);
  const setHeaderPosition = useUIStore((s) => s.setHeaderPosition);
  const headerPosition = useUIStore((s) => s.headerPosition);
  const t = useTranslations('sidebarCoach');
  const mounted = useMounted();

  const [step, setStep] = useState<Step>('sidebar');
  const [rect, setRect] = useState<Rect | null>(null);
  const stepRef = useRef<Step>(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // The tour only advances when a drag actually re-docks something, and useDockDrag is
  // built with `disabled: !isDesktop` at this same 1024px threshold — so below it the
  // tour is an unwinnable dead-end rather than a tour. Closing it on the way down also
  // keeps a narrowed window from leaving `sidebarCoachOpen` set, which would reopen the
  // tour on the next widen. `open` is a dep so a launch from a phone-width palette is
  // cleared immediately; the width is read live, never from state, so a desktop mount
  // (where isDesktop is still false on first render) can't close a legitimate tour.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (!desktop && open) setOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [open, setOpen]);

  const measure = useCallback((which: 'sidebar' | 'header') => {
    const el = document.querySelector(which === 'sidebar' ? '.sidebar-panel' : '[data-tour="header"]');
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  // Reset to the first step whenever the tour is (re)opened.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setStep('sidebar'));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Measure the active target (and keep it in sync on resize).
  useEffect(() => {
    if (!open || (step !== 'sidebar' && step !== 'header')) return;
    const which = step === 'sidebar' ? 'sidebar' : 'header';
    const raf = requestAnimationFrame(() => measure(which));
    const onResize = () => measure(which);
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [open, step, measure]);

  // Advance when the user actually repositions the element (store change).
  useEffect(() => {
    if (!open) return;
    const unsub = useUIStore.subscribe((state, prev) => {
      const s = stepRef.current;
      if (s === 'sidebar' && state.sidebarPosition !== prev.sidebarPosition) setStep('sidebar-done');
      else if (s === 'header' && state.headerPosition !== prev.headerPosition) setStep('header-done');
    });
    return unsub;
  }, [open]);

  // "Good!" beat between steps.
  useEffect(() => {
    if (step === 'sidebar-done') {
      const tmr = setTimeout(() => setStep('header'), 1300);
      return () => clearTimeout(tmr);
    }
    if (step === 'header-done') {
      const tmr = setTimeout(() => setStep('confirm'), 1300);
      return () => clearTimeout(tmr);
    }
  }, [step]);

  // Escape aborts the tour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open || !mounted || !isDesktop) return null;

  const isInteractive = step === 'sidebar' || step === 'header';
  const isDone = step === 'sidebar-done' || step === 'header-done';
  const onScreen = !!rect && rect.width > 40 && rect.left > -8;
  // Keep the instruction card clear of the header's current edge.
  const cardAtBottom = headerPosition !== 'bottom';

  const title = step === 'header' || step === 'header-done' ? t('header_move_title') : t('sidebar_move_title');
  const hint = step === 'header' ? t('header_move_hint') : t('sidebar_move_hint');
  const stepNum = step === 'sidebar' || step === 'sidebar-done' ? 1 : 2;

  return createPortal(
    <div className="fixed inset-0 z-[100000] pointer-events-none" style={{ animation: 'coach-fade-in 0.25s ease' }}>
      {/* Steady highlight + one clean grab-and-drag pill (interactive steps only) */}
      {isInteractive && onScreen && rect && (
        <>
          <div
            className="absolute rounded-[var(--radius-xl)]"
            style={{
              top: rect.top - 3, left: rect.left - 3, width: rect.width + 6, height: rect.height + 6,
              border: '2px solid var(--accent)',
              animation: 'coach-glow 2.4s ease-in-out infinite',
            }}
          />
          <div
            className="absolute"
            style={{ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-full"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                boxShadow: '0 12px 30px -8px var(--accent-glow)',
                animation: `${step === 'sidebar' ? 'coach-nudge-h' : 'coach-nudge-v'} 1.5s ease-in-out infinite`,
              }}
            >
              <Grab size={18} />
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.35)' }} />
              {step === 'sidebar' ? <MoveHorizontal size={18} strokeWidth={2.5} /> : <MoveVertical size={18} strokeWidth={2.5} />}
            </div>
          </div>
        </>
      )}

      {/* Instruction card (click-through everywhere except here) */}
      {isInteractive && (
        <div
          className="absolute left-1/2 w-[320px] max-w-[calc(100vw-32px)] rounded-[var(--radius-xl)] p-5 pointer-events-auto animate-scale-in"
          style={{
            [cardAtBottom ? 'bottom' : 'top']: 28,
            transform: 'translateX(-50%)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
              {t('coach_step', { n: stepNum })}
            </span>
            <h3 className="text-sm font-bold flex-1" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex-center rounded-lg shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label={t('coach_skip')}
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>{hint}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {[1, 2].map((n) => (
                <span key={n} className="rounded-full transition-all" style={{ width: n === stepNum ? 18 : 6, height: 6, background: n === stepNum ? 'var(--accent)' : 'var(--color-border-medium)' }} />
              ))}
            </div>
            <button onClick={() => setOpen(false)} className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {t('coach_skip')}
            </button>
          </div>
        </div>
      )}

      {/* "Good!" beat */}
      {isDone && (
        <div className="absolute inset-0 flex-center">
          <div className="flex items-center gap-2.5 px-6 py-4 rounded-[var(--radius-xl)] animate-scale-in" style={{ background: 'var(--color-surface)', border: '1px solid var(--accent-border)', boxShadow: 'var(--shadow-modal)' }}>
            <span className="w-9 h-9 flex-center rounded-full" style={{ background: 'var(--color-success)', color: '#fff' }}>
              <Check size={20} strokeWidth={3} />
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{t('coach_good')}</span>
          </div>
        </div>
      )}

      {/* Keep / reset confirmation */}
      {step === 'confirm' && (
        <div className="absolute inset-0 flex-center pointer-events-auto" style={{ background: 'rgba(3, 16, 30, 0.5)', backdropFilter: 'blur(3px)' }}>
          <div className="w-[320px] max-w-[calc(100vw-32px)] rounded-[var(--radius-xl)] p-6 animate-scale-in text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-modal)' }}>
            <span className="w-12 h-12 flex-center rounded-full mx-auto mb-3" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
              <Check size={22} strokeWidth={2.5} />
            </span>
            <h3 className="text-base font-bold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>{t('coach_keep_question')}</h3>
            <p className="text-xs mb-5" style={{ color: 'var(--color-text-muted)' }}>{t('coach_keep_hint')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-[var(--radius-md)] text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {t('coach_keep')}
              </button>
              <button
                onClick={() => { setSidebarPosition('left'); setHeaderPosition('top'); setOpen(false); }}
                className="w-full py-2.5 rounded-[var(--radius-md)] text-sm font-semibold flex-center gap-1.5 transition-colors"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <RotateCcw size={14} /> {t('coach_reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
