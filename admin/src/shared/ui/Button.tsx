'use client';

import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gradient';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: `
    text-white font-semibold
    hover:-translate-y-px hover:shadow-[0_8px_20px_-6px_rgba(var(--accent-rgb),0.45)]
    active:scale-[0.97] active:translate-y-0
    disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none
  `,
  gradient: `
    text-white font-semibold
    hover:-translate-y-px hover:shadow-[0_8px_20px_-6px_rgba(var(--accent-rgb),0.45)]
    active:scale-[0.97] active:translate-y-0
    disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none
  `,
  secondary: `
    bg-[var(--color-surface-2)] text-[var(--color-text-primary)] font-medium
    border border-[var(--color-border-medium)]
    hover:bg-[var(--color-surface-3)] hover:border-[var(--color-border-medium)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)] font-medium
    hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
  danger: `
    text-white font-semibold
    hover:opacity-90
    active:scale-[0.97]
    disabled:opacity-50
  `,
  outline: `
    bg-transparent text-[var(--accent)] font-medium
    border border-[var(--accent-border)]
    hover:bg-[var(--accent-subtle)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
};

const sizeStyles: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-[var(--radius-md)]',
  md: 'h-9 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-10 px-5 text-sm gap-2 rounded-[var(--radius-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className = '',
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const computedStyle: React.CSSProperties =
      variant === 'gradient'
        ? { background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)', ...style }
        : variant === 'primary'
        ? { background: 'var(--accent)', ...style }
        : variant === 'danger'
        ? { background: 'var(--color-danger)', ...style }
        : (style ?? {});

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          transition-all duration-150 cursor-pointer
          select-none whitespace-nowrap
          ${variantClasses[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : ''}
          ${className}
        `}
        style={computedStyle}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
        {!loading && icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    );
  },
);

Button.displayName = 'Button';
