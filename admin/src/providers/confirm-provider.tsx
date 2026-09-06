'use client';

import { createContext, useContext, useId, useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useEscapeToClose } from '@/shared/ui/escape-layer';
import { Z_DIALOG } from '@/shared/ui/z-layers';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  type?: 'confirm' | 'success' | 'error' | 'warning' | 'loading';
  /** Runs while the modal shows its loading state. The return value is
   *  discarded — only whether it resolves or throws is used. */
  onConfirm?: () => unknown | Promise<unknown>;
}

interface PromptOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  inputLabel?: string;
  inputType?: 'text' | 'number' | 'password';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('usePrompt must be used within a ConfirmProvider');
  }
  return ctx.prompt;
}

interface ConfirmProviderProps {
  children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [modalState, setModalState] = useState<{
    open: boolean;
    type: 'confirm' | 'success' | 'error' | 'warning' | 'loading' | 'prompt';
    title?: string;
    message: string;
    options: ConfirmOptions | PromptOptions;
    resolveBoolean?: (val: boolean) => void;
    resolveString?: (val: string | null) => void;
    value?: string;
  } | null>(null);

  const [mounted, setMounted] = useState(false);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Where the keyboard was before the dialog took it. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const bodyId = `${dialogId}-body`;

  const dialogOpen = modalState !== null;
  const isPrompt = modalState?.type === 'prompt';

  // The dialog's own chrome — its two buttons and the loading/success/error
  // states — was hardcoded English in a uz/ru/en panel, so the busiest dialog
  // there is (approve/reject on /listings, which passes no labels at all) put
  // "Cancel" and "Confirm" under an Uzbek question. The provider sits below
  // `NextIntlClientProvider`, so the catalogue is available here; call sites
  // that pass a specific action verb still win over these defaults.
  const c = useTranslations('common');

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Hold the page still underneath the dialog.
   *
   * On a phone this is a bottom sheet, and without the lock a drag on the dim
   * area scrolled the listings queue behind it — the sheet appeared to float
   * over a moving page. The previous value is saved and put back rather than
   * cleared: this dialog is most often raised from inside a moderation sheet
   * or a Modal that has already set `hidden`, and writing '' on the way out
   * would hand scrolling back to the page while that sheet is still open.
   */
  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dialogOpen]);

  /**
   * Focus goes to the panel itself, never to a button.
   *
   * A prompt's `Input` carries `autoFocus`, so taking focus off it would stop
   * the admin typing the thing they were asked for. And on a destructive
   * confirm — deactivate a staff account, reject a listing — focusing the
   * danger button turns a stray Enter into the decision. `tabIndex={-1}` makes
   * the panel a focus target without adding a tab stop of its own, and the Tab
   * cycle below keeps the keyboard inside it.
   */
  useEffect(() => {
    if (!dialogOpen) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    if (!isPrompt) panelRef.current?.focus();
    return () => {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [dialogOpen, isPrompt]);

  const confirm = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        open: true,
        type: options.type || 'confirm',
        title: options.title,
        message: options.message,
        options,
        resolveBoolean: resolve,
      });
    });
  };

  const prompt = (options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setModalState({
        open: true,
        type: 'prompt',
        title: options.title,
        message: options.message,
        options,
        resolveString: resolve,
        value: options.defaultValue ?? '',
      });
    });
  };

  const handleClose = () => {
    if (modalState) {
      if (modalState.type === 'prompt') {
        modalState.resolveString?.(null);
      } else {
        modalState.resolveBoolean?.(false);
      }
      setModalState(null);
    }
  };

  // Escape cancels, through the shared stack so a confirm raised from inside a
  // moderation sheet peels only itself and the sheet below it stays open. The
  // loading state is exempt for the same reason the backdrop is: the work is
  // already in flight and there is nothing left to cancel.
  useEscapeToClose(dialogOpen, () => {
    if (modalState && modalState.type !== 'loading') handleClose();
  });

  /** Tab wraps inside the panel. Without it the keyboard walked straight out
   *  of the dialog into the page under the backdrop — the sidebar links
   *  included — while the dialog was still waiting for an answer. */
  const cycleTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleConfirm = async () => {
    if (!modalState) return;

    if (modalState.type === 'prompt') {
      modalState.resolveString?.(modalState.value ?? '');
      setModalState(null);
      return;
    }

    const confirmOpts = modalState.options as ConfirmOptions;
    if (confirmOpts.onConfirm) {
      try {
        setModalState((prev) =>
          prev
            ? {
                ...prev,
                type: 'loading',
                title: prev.options.title ? `${prev.options.title}...` : c('loading'),
              }
            : null
        );

        await confirmOpts.onConfirm!();
        // Resolved only now that the work has actually succeeded. This used to
        // resolve `true` *before* the await, which left the `resolve(false)` in
        // the catch below landing on an already-settled promise — a caller
        // written as `if (await confirm({ onConfirm: doDelete })) { ... }` ran
        // its success branch even when the delete threw.
        modalState.resolveBoolean?.(true);

        setModalState((prev) =>
          prev
            ? {
                ...prev,
                type: 'success',
                title: c('success'),
                // The catalogue carries no sentence-length success string, and
                // the ring plus the title already say it — better an empty body
                // than an English one in a panel that is otherwise translated.
                message: '',
              }
            : null
        );
      } catch (err) {
        modalState.resolveBoolean?.(false);
        setModalState((prev) =>
          prev
            ? {
                ...prev,
                type: 'error',
                title: c('error'),
                message: (err instanceof Error && err.message) || c('error'),
              }
            : null
        );
      }
    } else {
      modalState.resolveBoolean?.(true);
      setModalState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      {/* The literal `z-[999999]` the portal below used to carry was a number
          picked to beat the mobile dock, and it beat the toast layer with it —
          so an error raised while this dialog was open was painted under its
          own blurred backdrop. `Z_DIALOG` is the 100000 every other dialog
          uses: still above the dock, now correctly below a toast. */}
      {modalState && mounted && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center md:p-4"
          style={{ zIndex: Z_DIALOG }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'rgba(5, 11, 22, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              // A drag on the dim area must not scroll the page behind it. The
              // body lock covers this once it applies; `touchAction` is what
              // stops the very first touch-move on iOS from chaining.
              touchAction: 'none',
            }}
            onClick={modalState.type !== 'loading' ? handleClose : undefined}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            // The heading is conditional — several call sites pass only a
            // message, and the success state blanks it — so the message is the
            // fallback name rather than leaving the dialog unnamed.
            aria-labelledby={modalState.title ? titleId : undefined}
            aria-label={modalState.title ? undefined : modalState.message || undefined}
            aria-describedby={bodyId}
            tabIndex={-1}
            onKeyDown={cycleTab}
            className="relative w-full max-h-[85vh] flex flex-col overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl transition-all duration-300
                       md:max-w-sm md:rounded-[24px] animate-scale-in
                       max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-[28px] max-md:border-b-0 animate-slide-up-mobile"
          >
            <div className="hidden max-md:block w-12 h-1 bg-[var(--color-border-medium)] rounded-full mx-auto mt-3 shrink-0" />

            <div
              className="px-6 pt-6 pb-5 flex-1 overflow-y-auto text-center flex flex-col items-center"
              style={{ overscrollBehavior: 'contain' }}
            >
              {modalState.type === 'success' && (
                <div className="flex justify-center mb-5 shrink-0">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-success-ring" />
                    <div className="absolute inset-2 rounded-full border border-emerald-500/25 bg-emerald-500/5" />
                    <svg className="relative z-10 w-14 h-14 text-emerald-500" viewBox="0 0 52 52" fill="none">
                      <circle cx="26" cy="26" r="19" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2.5" />
                      <path
                        className="animate-success-check"
                        d="M16 27.2l6.1 6.2L36.4 19"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {(modalState.type === 'confirm' || modalState.type === 'warning') && (
                <div className="flex justify-center mb-4 shrink-0">
                  <div className={`w-16 h-16 rounded-full flex-center animate-pulse-status ${'isDestructive' in modalState.options && modalState.options.isDestructive ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={32} />
                  </div>
                </div>
              )}

              {modalState.type === 'error' && (
                <div className="flex justify-center mb-4 shrink-0">
                  <div className="w-16 h-16 rounded-full flex-center bg-rose-500/10 text-rose-500 animate-bounce">
                    <AlertTriangle size={32} />
                  </div>
                </div>
              )}

              {modalState.type === 'loading' && (
                <div className="flex justify-center mb-4 shrink-0">
                  <div className="w-12 h-12 rounded-full border-3 border-t-[var(--accent)] border-[var(--color-border)] animate-spin" />
                </div>
              )}

              {modalState.type === 'prompt' && (
                <div className="w-full mt-2 space-y-3 text-left">
                  <div className="text-center">
                    <h3 id={titleId} className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                      {modalState.title}
                    </h3>
                    <p id={bodyId} className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-[280px] mx-auto">
                      {modalState.message}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {('inputLabel' in modalState.options) && modalState.options.inputLabel && (
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        {modalState.options.inputLabel}
                      </label>
                    )}
                    <Input
                      ref={promptInputRef}
                      autoFocus
                      type={('inputType' in modalState.options ? modalState.options.inputType : undefined) || 'text'}
                      value={modalState.value ?? ''}
                      onChange={(e) => setModalState((prev) => prev ? { ...prev, value: e.target.value } : prev)}
                      placeholder={'placeholder' in modalState.options ? modalState.options.placeholder : undefined}
                      fullWidth
                    />
                  </div>
                </div>
              )}

              {modalState.type !== 'prompt' && modalState.title && (
                <h3 id={titleId} className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                  {modalState.title}
                </h3>
              )}

              {modalState.type !== 'prompt' && (
                <p id={bodyId} className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-[280px]">
                  {modalState.message}
                </p>
              )}
            </div>

            {modalState.type !== 'loading' && (
              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col gap-2 shrink-0 max-md:pb-8">
                {modalState.type === 'confirm' ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-xs" type="button" onClick={handleClose}>
                      {/* `||`, not `??`: a call site that passes an empty label
                          gets the catalogue default rather than a blank button. */}
                      {modalState.options.cancelLabel || c('cancel')}
                    </Button>
                    <Button
                      variant={'isDestructive' in modalState.options && modalState.options.isDestructive ? 'danger' : 'primary'}
                      className="flex-1 text-xs"
                      type="button"
                      onClick={handleConfirm}
                    >
                      {modalState.options.confirmLabel || c('confirm')}
                    </Button>
                  </div>
                ) : modalState.type === 'prompt' ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-xs" type="button" onClick={handleClose}>
                      {modalState.options.cancelLabel || c('cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 text-xs"
                      type="button"
                      onClick={handleConfirm}
                    >
                      {/* `common` has no `ok` key in any of the three
                          catalogues, and confirm reads the same on a prompt. */}
                      {modalState.options.confirmLabel || c('confirm')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    type="button"
                    onClick={handleClose}
                  >
                    {modalState.options.confirmLabel || c('close')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}
