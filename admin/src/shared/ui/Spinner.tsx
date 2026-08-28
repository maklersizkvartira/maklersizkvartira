'use client';

/** `label` is the accessible name a screen reader announces. English is the
 *  fallback, not the intent — pass `common.loading` from the page. */
export function Spinner({
  size = 'md',
  label = 'Loading',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  const sizeMap = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' };
  return (
    <div
      className={`${sizeMap[size]} border-[var(--color-border)] border-t-[var(--color-brand-600)] rounded-full animate-spin ${className}`}
      role="status"
      aria-label={label}
    />
  );
}
