'use client';

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
                title: prev.options.title ? `${prev.options.title}...` : 'Processing...',
              }
            : null
        );

        modalState.resolveBoolean?.(true);
        await confirmOpts.onConfirm!();

        setModalState((prev) =>
          prev
            ? {
                ...prev,
                type: 'success',
                title: 'Success',
                message: 'Operation completed successfully.',
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
                title: 'Error',
                message:
                  (err instanceof Error && err.message) ||
                  'An unexpected error occurred.',
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
      {modalState && mounted && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center md:p-4">
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'rgba(5, 11, 22, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={modalState.type !== 'loading' ? handleClose : undefined}
          />

          <div
            className="relative w-full max-h-[85vh] flex flex-col overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl transition-all duration-300
                       md:max-w-sm md:rounded-[24px] animate-scale-in
                       max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-[28px] max-md:border-b-0 animate-slide-up-mobile"
          >
            <div className="hidden max-md:block w-12 h-1 bg-[var(--color-border-medium)] rounded-full mx-auto mt-3 shrink-0" />

            <div className="px-6 pt-6 pb-5 flex-1 overflow-y-auto text-center flex flex-col items-center">
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
                    <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                      {modalState.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-[280px] mx-auto">
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
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                  {modalState.title}
                </h3>
              )}

              {modalState.type !== 'prompt' && (
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-[280px]">
                  {modalState.message}
                </p>
              )}
            </div>

            {modalState.type !== 'loading' && (
              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col gap-2 shrink-0 max-md:pb-8">
                {modalState.type === 'confirm' ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-xs" type="button" onClick={handleClose}>
                      {modalState.options.cancelLabel || 'Cancel'}
                    </Button>
                    <Button
                      variant={'isDestructive' in modalState.options && modalState.options.isDestructive ? 'danger' : 'primary'}
                      className="flex-1 text-xs"
                      type="button"
                      onClick={handleConfirm}
                    >
                      {modalState.options.confirmLabel || 'Confirm'}
                    </Button>
                  </div>
                ) : modalState.type === 'prompt' ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-xs" type="button" onClick={handleClose}>
                      {modalState.options.cancelLabel || 'Cancel'}
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 text-xs"
                      type="button"
                      onClick={handleConfirm}
                    >
                      {modalState.options.confirmLabel || 'OK'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    className="w-full text-xs"
                    type="button"
                    onClick={handleClose}
                  >
                    {modalState.options.confirmLabel || 'Close'}
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
