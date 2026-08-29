'use client';

import { useEffect, useState } from 'react';

/**
 * Measures the box a chart is about to be drawn into, so the SVG coordinate
 * system can be one unit per CSS pixel.
 *
 * Why this is not optional: the charts used to be drawn at a fixed
 * `viewBox="0 0 600 240"` and scaled down into whatever width the card
 * happened to be. In a ~343px card on a phone that is a 0.57 scale factor, so
 * the 10px axis labels rendered at about 5.7px — data on screen that nobody
 * can read is data that is hidden, and the trend card is where three of the
 * four endpoints now live.
 *
 * The ref is a callback ref rather than `useRef`, because the caller mounts
 * the measured box only once it has data: a `useRef` + `[]` effect would run
 * while the loading skeleton was still up, find nothing to observe, and never
 * run again.
 */

export interface ChartBox {
  width: number;
  height: number;
}

export function useChartSize(fallback: ChartBox = { width: 600, height: 240 }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState<ChartBox>(fallback);

  useEffect(() => {
    if (!node) return;

    const read = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width <= 0 || height <= 0) return;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    read();

    // Not every browser the panel supports has ResizeObserver; a window
    // listener catches the only resize a desktop actually performs.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }

    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref: setNode, box };
}
