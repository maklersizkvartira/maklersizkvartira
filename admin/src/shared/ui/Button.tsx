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
    text-white
    disabled:opacity-50
    active:scale-[0.97]
  `,
  gradient: `
    text-white
    disabled:opacity-50
    active:scale-[0.97]
  `,
  secondary: `
    bg-[var(--color-surface-2)] text-[var(--color-text-primary)]
    border border-[var(--color-border)]
    hover:bg-[var(--color-surface-3)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)]
    hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
  danger: `
    bg-[var(--color-danger)] text-white
    hover:opacity-90
    active:scale-[0.97]
    disabled:opacity-50
  `,
  outline: `
    bg-transparent text-[var(--color-brand-600)]
    border border-[var(--color-brand-500)]
    hover:bg-[var(--color-info-bg)]
    active:scale-[0.97]
    disabled:opacity-50
  `,
};

const sizeStyles: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-[var(--radius-sm)]',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-[var(--radius-md)]',
  md: 'h-9 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-11 px-5 text-base gap-2 rounded-[var(--radius-md)]',
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

    const gradientStyle: React.CSSProperties =
      variant === 'primary' || variant === 'gradient'
        ? {
            background: 'var(--gradient-brand)',
            boxShadow: '0 2px 8px var(--accent-glow)',
            ...style,
          }
        : (style ?? {});

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-150 cursor-pointer
          select-none whitespace-nowrap
          ${variantClasses[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : ''}
          ${className}
        `}
        style={gradientStyle}
        {...props}
      >
        {loading && (
          <span
            className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"
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
