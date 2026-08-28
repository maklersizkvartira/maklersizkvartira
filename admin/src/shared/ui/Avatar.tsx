'use client';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', dot: 'w-1.5 h-1.5' },
  sm: { container: 'w-8 h-8', text: 'text-xs', dot: 'w-2 h-2' },
  md: { container: 'w-9 h-9', text: 'text-sm', dot: 'w-2.5 h-2.5' },
  lg: { container: 'w-10 h-10', text: 'text-sm', dot: 'w-2.5 h-2.5' },
  xl: { container: 'w-12 h-12', text: 'text-base', dot: 'w-3 h-3' },
};

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getColorFromName(name?: string): string {
  const colors = [
    'bg-violet-100 text-violet-700',
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-purple-100 text-purple-700',
    'bg-indigo-100 text-indigo-700',
  ];
  const index = (name?.charCodeAt(0) ?? 0) % colors.length;
  return colors[index] ?? colors[0] ?? '';
}

export function Avatar({ src, name, size = 'md', className = '', online }: AvatarProps) {
  const s = sizeMap[size];
  const colorClass = getColorFromName(name);

  return (
    <div className={`relative shrink-0 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? 'avatar'}
          className={`${s.container} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${s.container} ${s.text} ${colorClass} rounded-full flex-center font-semibold select-none`}
        >
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${s.dot} rounded-full border-2 border-[var(--color-surface)] ${
            online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'
          }`}
        />
      )}
    </div>
  );
}
