/**
 * The copy pack for a language, as a hook that re-renders when it arrives.
 *
 * Reading `copyFor(language)` directly is a trap: the packs are lazily loaded,
 * so a component that switches to Russian reads the pack *before* the Russian
 * chunk lands, and nothing tells it to look again. Anything memoised on
 * `[route, language]` then keeps the wrong pack forever, because neither of
 * those changed when the real one arrived — which is how a page could end up
 * at `/ru/toshkent/chilonzor` showing Uzbek prose.
 *
 * The returned pack's identity changes when the load completes, so putting it
 * in a `useMemo` dependency list is enough to make everything downstream
 * correct.
 */

import { useEffect, useState } from 'react';

import { copyFor, isCopyLoaded, loadCopy, type CopyPack } from './content';
import type { Language } from '../i18n/types';

export function useSeoCopy(language: Language): CopyPack {
  const [, bump] = useState(0);

  useEffect(() => {
    if (isCopyLoaded(language)) return;
    let cancelled = false;
    void loadCopy(language).then(() => {
      if (!cancelled) bump((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return copyFor(language);
}
