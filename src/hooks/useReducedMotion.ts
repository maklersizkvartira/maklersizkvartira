/**
 * Does this visitor want less movement?
 *
 * `index.css` already clamps every CSS animation and transition to 0.01ms
 * under `prefers-reduced-motion`, and that covers everything the stylesheet
 * drives. It reaches nothing else: a `setInterval` that advances a carousel
 * every ten seconds still advances, `element.scrollIntoView({ behavior:
 * 'smooth' })` still glides, and a framer-motion spring still springs,
 * because none of those are CSS rules the media query can shorten.
 *
 * So JavaScript has to ask the same question the stylesheet asks, and this is
 * where it asks it. A carousel reads it and stops auto-rotating; a wizard
 * reads it and jumps to the next step instead of scrolling to it.
 *
 * Usage:
 *     const reduced = useReducedMotion();
 *     if (reduced) return;           // skip the timer entirely
 *     el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The same question, asked once, outside React.
 *
 * Exported because the store has to ask it too and a store cannot call a hook:
 * `navigate` scrolls the window to the top of every new view, and
 * `scrollTo({ behavior: 'smooth' })` passes its behaviour explicitly, so it
 * overrides the `scroll-behavior: auto !important` the stylesheet sets under
 * `prefers-reduced-motion`. Left alone it was the one piece of movement on
 * this site that the media query could not switch off.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  // Seeded synchronously rather than in an effect: a carousel that reads this
  // on its first render must not start a timer it immediately has to cancel.
  // On the server it answers `false`, which matches what the prerendered HTML
  // can know, and the first client render corrects it.
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(QUERY);
    // Re-read on mount: hydration may have started from the server's `false`.
    setReduced(query.matches);

    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reduced;
}

export default useReducedMotion;
