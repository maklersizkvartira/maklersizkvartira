/**
 * A navigation link that is also a real link.
 *
 * Every destination on this site used to be a `<button onClick>`. That works
 * for a person with JavaScript and for nobody else: a crawler sees no outbound
 * edge, so no page beyond the entry point is discoverable, and a visitor
 * cannot middle-click, cannot copy the address, and cannot open anything in a
 * new tab.
 *
 * `className` passes straight through, so swapping a `<button>` for this
 * renders identically — the existing Tailwind classes do all the work. The
 * click handler intercepts only a plain left click; every modified click falls
 * through to the browser so ctrl/cmd-click still opens a new tab.
 */

import React, { useCallback } from 'react';

import { useAppStore } from '../stores/useAppStore';
import { localisedPath } from './language';
import type { ViewState } from './views';
import { viewPath } from '../seo/routes';

export interface AppLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An absolute in-site path, e.g. `/toshkent/chilonzor`. */
  to?: string;
  /** Or a view, for the app's own screens. */
  view?: ViewState;
  listingId?: string | null;
  /** Runs before navigating — closing a drawer, for instance. */
  onNavigate?: () => void;
}

function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  );
}

export const AppLink: React.FC<AppLinkProps> = ({
  to,
  view,
  listingId = null,
  onNavigate,
  onClick,
  children,
  ...rest
}) => {
  const language = useAppStore((state) => state.language);
  const navigate = useAppStore((state) => state.navigate);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const path = to ?? viewPath(view ?? 'HOME', listingId);
  const href = localisedPath(path, language);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (!isPlainLeftClick(event)) return;
      event.preventDefault();
      onNavigate?.();
      // Views keep going through `setCurrentView` so the auth guard and every
      // other behaviour attached to it still applies.
      if (view) setCurrentView(view, listingId);
      else navigate(path);
    },
    [onClick, onNavigate, view, listingId, setCurrentView, navigate, path],
  );

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};

export default AppLink;
