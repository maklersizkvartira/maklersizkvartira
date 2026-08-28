/**
 * The home page's readable half.
 *
 * Before this, the entire indexable text of the site's most important page was
 * roughly sixty words of UI chrome — button labels, filter names, category
 * chips. There was nothing for a search engine to understand the site *by*,
 * and nothing for a first-time visitor to read before deciding whether this
 * is a real marketplace or another broker in disguise.
 *
 * It also carries the hub links, which is what puts every category, every
 * Tashkent district and every prominent region exactly one click from the
 * root. Without it the generated landing pages would be reachable only
 * through the sitemap, and would be crawled accordingly.
 *
 * Hidden on phones. Its link groups render as columns, which directly above
 * the real footer read as a second one — on a narrow screen the page appeared
 * to end twice. It is hidden rather than dropped: prerendering puts the whole
 * section in the HTML either way, so a crawler still reads the prose and still
 * follows every hub link. Only the phone viewport loses it.
 */

import React from 'react';

import { useSeoCopy } from '../../seo/useSeoCopy';
import { hubLinks } from '../../seo/links';
import { useAppStore } from '../../stores/useAppStore';
import { FaqSection, LinkGroups, Prose } from '../seo/blocks';

export const HomeSeoSection: React.FC = () => {
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);

  return (
    <section className="mx-auto hidden w-full max-w-7xl px-4 pb-14 pt-4 sm:px-6 lg:block">
      <div className="max-w-3xl space-y-3">
        <h2 className="text-lg font-black text-content sm:text-xl">{copy.home.h1}</h2>
        <Prose paragraphs={copy.home.intro} />
      </div>

      <LinkGroups heading={copy.common.exploreHeading} groups={hubLinks(language)} />
      <FaqSection heading={copy.common.faqHeading} entries={copy.home.faq} />
    </section>
  );
};

export default HomeSeoSection;
