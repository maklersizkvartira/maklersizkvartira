/**
 * Run an action, or ask the visitor to sign in first.
 *
 * Every gated action on the site — saving a favourite, opening a phone
 * number, starting a chat, posting a listing — had the same three lines
 * copied into it: read `currentUser`, and if it is null call `setShowAuth`
 * instead. Copied code drifts, and it had: some call sites opened the sign-in
 * flow on the register tab, some on login, and one silently did nothing.
 *
 * Usage:
 *     const requireAuth = useRequireAuth();
 *     <button onClick={() => requireAuth(() => toggleFavorite(id))} />
 *
 * The default tab is LOGIN, matching the store's own default. Pass
 * 'REGISTER' where the action is one a brand-new visitor is more likely to be
 * doing — posting a first listing, for instance.
 *
 * `setShowAuth` navigates to /login or /register now rather than opening a
 * dialog, and remembers the page it was called from so the visitor is
 * returned to it. That is why the action below can still be dropped: they
 * come back to the screen they pressed the button on.
 */

import { useCallback } from 'react';

import { useAppStore } from '../stores/useAppStore';

type AuthTab = 'LOGIN' | 'REGISTER';

export type RequireAuth = (action: () => void, tab?: AuthTab) => void;

export function useRequireAuth(): RequireAuth {
  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);

  return useCallback(
    (action: () => void, tab: AuthTab = 'LOGIN') => {
      if (currentUser) {
        action();
        return;
      }
      // The action is deliberately dropped rather than queued. Replaying it
      // after a sign-in that may take three screens and an SMS means firing a
      // side effect the visitor has long stopped expecting; they can press the
      // button again, and it will work.
      setShowAuth(true, tab);
    },
    [currentUser, setShowAuth],
  );
}

/** Whether there is a signed-in user, for callers that only need the flag. */
export function useIsAuthenticated(): boolean {
  return useAppStore((state) => state.currentUser !== null);
}

export default useRequireAuth;
