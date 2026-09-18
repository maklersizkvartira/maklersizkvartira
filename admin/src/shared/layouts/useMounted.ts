'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns `false` during SSR and the first (hydration) render, then `true` once
 * mounted on the client. Uses `useSyncExternalStore` so there is no
 * setState-in-effect and no extra render pass — the hydration snapshot (`false`)
 * matches the server, and React re-renders with the client snapshot (`true`).
 *
 * Use this to gate client-only work such as portals (`createPortal`) or reads of
 * browser-only APIs, instead of the `useState(false)` + `useEffect(setTrue)` guard.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
