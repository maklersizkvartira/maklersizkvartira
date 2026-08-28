/**
 * The card treatment, extracted from the twenty places that re-typed it.
 *
 * Reading ListingsPage, ProfilePage and CreateListingPage, the dominant
 * pattern is exactly one string —
 *
 *     rounded-2xl border border-line bg-surface p-5 shadow-card
 *
 * — with two deliberate variations and one accident. The variations: a
 * *nested* card (a panel inside a card) drops the shadow and sits on
 * `bg-surface-2`, and a *large* card rounds to `3xl` and pads to 6/8. The
 * accident is that the radius, the padding and the surface were picked
 * independently at each site, so three panels beside each other on the create
 * page have three different corner radii.
 *
 * `Section` is the labelled variant ProfilePage and CreateListingPage both
 * built by hand: an icon in a brand-tinted square, a heading wired to the
 * section with `aria-labelledby`, an optional description and an action slot.
 * A card with a visible heading should be a landmark; hand-rolled ones were
 * plain <div>s, so a screen reader saw one long page with no structure.
 */

import React, { useId } from 'react';

import { cn } from '../../lib/cn';

type CardTone = 'surface' | 'nested' | 'brand' | 'ghost';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const tones: Record<CardTone, string> = {
  /** The default: a card on the canvas. */
  surface: 'border border-line bg-surface shadow-card',
  /** A panel inside another card. No shadow — stacked shadows read as fog. */
  nested: 'border border-line bg-surface-2',
  /** A card that is itself the call to action. */
  brand: 'border border-brand/30 bg-brand-soft',
  /** Structure only, for a card that supplies its own background. */
  ghost: 'border border-transparent',
};

const paddings: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-5',
  lg: 'p-5 sm:p-6',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: CardPadding;
  /** `2xl` is the default; `3xl` is the large panel used on the create page. */
  radius?: '2xl' | '3xl';
  /** Adds tap feedback and a hover lift. For a card that is a link or button. */
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}

export const Card: React.FC<CardProps> = ({
  tone = 'surface',
  padding = 'md',
  radius = '2xl',
  interactive = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) => (
  // `Tag` is a union of intrinsic elements, so React narrows the prop type to
  // the intersection of all four and rejects the div handlers the interface
  // advertises. The rendered attributes are identical either way.
  <Tag
    {...(rest as React.HTMLAttributes<HTMLElement>)}
    className={cn(
      'relative',
      radius === '3xl' ? 'rounded-3xl' : 'rounded-2xl',
      tones[tone],
      paddings[padding],
      interactive &&
        'press-sm cursor-pointer transition-shadow hover:shadow-raised focus-within:shadow-raised',
      className,
    )}
  >
    {children}
  </Tag>
);

// ---------------------------------------------------------------------------
export interface SectionCardProps extends Omit<CardProps, 'title'> {
  title: string;
  description?: string;
  /** Rendered in the brand-tinted square beside the heading. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Top-right slot: a link, a count, a toggle. */
  action?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon: Icon,
  action,
  className,
  children,
  tone = 'surface',
  padding = 'md',
  radius = '2xl',
  ...rest
}) => {
  const headingId = useId();

  return (
    <section
      {...(rest as React.HTMLAttributes<HTMLElement>)}
      aria-labelledby={headingId}
      className={cn(
        'relative space-y-4',
        radius === '3xl' ? 'rounded-3xl' : 'rounded-2xl',
        tones[tone],
        paddings[padding],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 rounded-lg bg-brand-soft p-1.5 text-brand-text">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-black text-content">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};

// ---------------------------------------------------------------------------
/** The empty state every list surface draws: centred, bordered, one action. */
export const CardEmpty: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, body, action, className }) => (
  <Card padding="none" className={cn('px-6 py-10 text-center', className)}>
    {Icon && (
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    <p className="text-sm font-black text-content">{title}</p>
    {body && <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{body}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </Card>
);

export default Card;
