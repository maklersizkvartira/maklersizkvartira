/**
 * Form primitives shared by the auth screens and the listing forms.
 *
 * They exist so every input in the app gets the same label association,
 * error wiring (`aria-invalid` + `aria-describedby`) and themed styling —
 * previously each form re-implemented these by hand, and most skipped the
 * accessibility parts entirely.
 */

import React, { useId, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { Dropdown } from './Dropdown';

/**
 * `text-base` is load-bearing and must not be shrunk.
 *
 * iOS Safari zooms the whole page when a field smaller than 16px takes focus,
 * and it does not zoom back out. Every "make the form denser" pass that drops
 * this to `text-sm` buys 2px of height and costs the visitor a viewport they
 * have to pinch their way out of on every single input.
 *
 * `min-h-11` is 44px, the tap target the padding almost reached already, and
 * `touch-manipulation` removes the ~300ms delay mobile browsers hold every
 * tap for while they wait to see whether it is a double-tap zoom.
 */
const inputBase =
  'w-full min-h-11 touch-manipulation rounded-xl border bg-surface-2 px-4 py-3 text-base ' +
  'font-medium text-content transition-colors placeholder:text-subtle focus:bg-surface ' +
  'focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const inputStates = {
  normal: 'border-line focus:border-brand',
  error: 'border-danger focus:border-danger',
  success: 'border-brand focus:border-brand',
};

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /**
   * A control belonging to this field, on the label's own line.
   *
   * For the thing that is about the field rather than about the form — "forgot
   * password?" next to a password box, a unit switch next to an amount. Given
   * a row of its own under the input it reads as orphaned: a lone right-
   * aligned link with nothing opposite it, separated from the only thing it
   * refers to.
   */
  action?: React.ReactNode;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  hint,
  error,
  required,
  action,
  children,
}) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-xs font-bold text-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
        {action}
      </div>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-semibold text-danger"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean;
  valid?: boolean;
  icon?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  invalid,
  valid,
  icon,
  className = '',
  ...rest
}) => {
  const state = invalid ? 'error' : valid ? 'success' : 'normal';
  return (
    <div className="relative">
      {icon && (
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <input
        {...rest}
        aria-invalid={invalid || undefined}
        // `cn`, not a template literal. A caller passing `px-3` used to ship
        // both its class and this base's `px-4`, and which one won was decided
        // by the order Tailwind happened to emit the two rules in — so an
        // override worked or did not depending on what an unrelated file had
        // added. `twMerge` resolves by group, last wins, caller last.
        className={cn(inputBase, inputStates[state], icon && 'pl-11', className)}
      />
      {valid && !invalid && (
        <Check
          className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
/**
 * A themed dropdown.
 *
 * This was a real `<select>` with `appearance-none`, which styled the closed
 * box and nothing else: the list that opens is drawn by the operating system
 * and no page CSS reaches it. So every dropdown still looked like someone
 * else's form the moment it was opened.
 *
 * It now renders {@link Dropdown}, which draws the open list too. The props
 * are unchanged — including an `onChange` that receives an event with
 * `target.value` — so the twenty call sites did not have to move.
 */
export interface SelectInputProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  invalid?: boolean;
  /** The dense variant used in filter bars and toolbars. */
  compact?: boolean;
  onChange?: (event: { target: { value: string } }) => void;
}

export const SelectInput: React.FC<SelectInputProps> = ({
  invalid,
  compact = false,
  className = '',
  children,
  value,
  onChange,
  id,
  disabled,
  ...rest
}) => (
  <Dropdown
    id={id}
    value={String(value ?? '')}
    // Callers were written against a `<select>` and read `event.target.value`.
    // Handing them the shape they already expect keeps this a drop-in swap
    // rather than an edit to every form in the app.
    onChange={(next) => onChange?.({ target: { value: next } })}
    invalid={invalid}
    disabled={disabled}
    compact={compact}
    className={className}
    aria-label={rest['aria-label']}
    aria-describedby={rest['aria-describedby']}
  >
    {children}
  </Dropdown>
);

// ---------------------------------------------------------------------------
export const PasswordInput: React.FC<TextInputProps> = ({
  invalid,
  className = '',
  ...rest
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        // `pr-14` clears the reveal button, which is now a full 44px target
        // rather than the 32px icon it used to be.
        className={cn(
          inputBase,
          invalid ? inputStates.error : inputStates.normal,
          'pr-14',
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-3 hover:text-content"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
/** Visual password-strength meter. Announced politely so it is not chatty. */
export const PasswordStrength: React.FC<{ score: number }> = ({ score }) => {
  const { t } = useTranslation();

  const level = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
  const labels = [
    t('auth.strength.veryWeak'),
    t('auth.strength.weak'),
    t('auth.strength.fair'),
    t('auth.strength.good'),
    t('auth.strength.strong'),
  ];
  const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-brand', 'bg-brand'];
  const textColors = [
    'text-danger',
    'text-danger',
    'text-warning',
    'text-brand-text',
    'text-brand-text',
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <div
            key={segment}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              segment < level ? colors[level] : 'bg-surface-3'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-bold ${textColors[level]}`} aria-live="polite">
        {t('auth.strength.label')}: {labels[level]}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover shadow-brand disabled:hover:bg-brand',
  secondary:
    'bg-surface-2 text-content border border-line hover:bg-surface-3',
  ghost: 'text-muted hover:bg-surface-2 hover:text-content',
  danger: 'bg-danger text-white hover:opacity-90',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    // `cn` matters most here: several call sites pass a denser
    // `px-4 py-2.5 text-xs` for a toolbar button, and against this base's
    // `px-5 py-3.5 text-sm` a plain concatenation left both in the attribute
    // with no defined winner.
    className={cn(
      'inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl',
      'px-5 py-3.5 text-sm font-bold transition-all active:scale-[0.98]',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
      buttonVariants[variant],
      fullWidth && 'w-full',
      className,
    )}
  >
    {loading && (
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    )}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
export const FormError: React.FC<{ message?: string | null }> = ({ message }) =>
  message ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-xs font-semibold text-danger"
    >
      <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  ) : null;
