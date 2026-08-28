/**
 * Class-name joining that survives Tailwind's cascade.
 *
 * `clsx` and `tailwind-merge` were both already dependencies and neither was
 * imported anywhere, so every component built its classes with template
 * literals. That works right up to the point where a caller passes
 * `className="bg-surface"` to a component whose own base string says
 * `bg-surface-2`: both land in the attribute, neither wins by intent, and the
 * outcome is decided by the order Tailwind happened to emit the two rules in.
 * Which one loses then changes when an unrelated file adds a utility.
 *
 * `twMerge` resolves that by group: the last value for a given Tailwind group
 * wins, so a caller's override actually overrides. `clsx` handles the
 * conditional and array forms first.
 *
 * Usage:
 *     cn('rounded-xl bg-surface-2 px-4', selected && 'bg-brand-soft', className)
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };

export default cn;
