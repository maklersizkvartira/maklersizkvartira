/**
 * The reusable pieces every content page is built from.
 *
 * They take plain props and touch no browser globals during render, because
 * the build-time prerenderer renders these same components to static HTML.
 * Anything that reached for `window` here would work in the browser and throw
 * at build time. (`AppLink` reads the store, which is safe: Zustand serves a
 * server snapshot and the store's own browser access is all guarded.)
 */

import React from 'react';

import type { FaqEntry } from '../../seo/content/types';
import type { LinkGroup } from '../../seo/links';
import { AppLink } from '../../router/AppLink';

// ---------------------------------------------------------------------------
export const PageIntro: React.FC<{
  h1: string;
  paragraphs: string[];
  /** Small line above the heading — a category label, usually. */
  eyebrow?: string;
}> = ({ h1, paragraphs, eyebrow }) => (
  <header className="max-w-3xl">
    {eyebrow ? (
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-brand-text">
        {eyebrow}
      </p>
    ) : null}
    <h1 className="text-balance text-2xl font-black leading-tight tracking-tight text-content sm:text-3xl">
      {h1}
    </h1>
    {paragraphs.length > 0 ? (
      <div className="mt-4 space-y-3">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed text-muted">
            {paragraph}
          </p>
        ))}
      </div>
    ) : null}
  </header>
);

// ---------------------------------------------------------------------------
export const Highlights: React.FC<{ items: string[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted"
        >
          {item}
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
/**
 * Answers are rendered open, not behind a disclosure widget.
 *
 * Content hidden behind a click is still indexed, but it is weighted as
 * secondary — and a visitor who has to open four panels to find out whether
 * there is a commission usually leaves instead.
 */
export const FaqSection: React.FC<{ heading: string; entries: FaqEntry[] }> = ({
  heading,
  entries,
}) => {
  if (entries.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-black text-content sm:text-xl">{heading}</h2>
      <dl className="mt-4 space-y-4">
        {entries.map((entry) => (
          <div key={entry.q} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <dt className="text-sm font-bold text-content">{entry.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{entry.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

// ---------------------------------------------------------------------------
export const LinkGroups: React.FC<{ heading: string; groups: LinkGroup[] }> = ({
  heading,
  groups,
}) => {
  if (groups.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-black text-content sm:text-xl">{heading}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h3 className="mb-2.5 text-xs font-black uppercase tracking-wide text-subtle">
              {group.heading}
            </h3>
            <ul className="flex flex-wrap gap-x-3 gap-y-2">
              {group.links.map((link) => (
                <li key={link.path}>
                  <AppLink
                    to={link.path}
                    className="text-xs font-semibold text-muted transition-colors hover:text-brand-text hover:underline"
                  >
                    {link.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
export const Prose: React.FC<{ paragraphs: string[] }> = ({ paragraphs }) => (
  <>
    {paragraphs.map((paragraph, index) => (
      <p key={index} className="text-sm leading-relaxed text-muted">
        {paragraph}
      </p>
    ))}
  </>
);
