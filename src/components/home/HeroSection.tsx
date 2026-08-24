/**
 * The home hero.
 *
 * The dark band is painted with the inverse surface token rather than a fixed
 * slate, so the hero keeps its high-contrast look and still flips with the
 * theme instead of staying a black rectangle on a dark page.
 *
 * The coverage figures come from the shipped geography taxonomy, not from a
 * hand-written marketing number.
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { UZBEKISTAN_REGIONS } from '../../data/mockLocations';
import { SearchModal } from './SearchModal';

const REGION_COUNT = UZBEKISTAN_REGIONS.length;
const DISTRICT_COUNT = UZBEKISTAN_REGIONS.reduce(
  (total, region) => total + region.districts.length,
  0,
);

export const HeroSection: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const [showSearchModal, setShowSearchModal] = useState(false);

  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-gradient-to-b from-band to-band-2 px-4 pb-24 pt-12 text-center text-on-band sm:px-6 sm:pb-28 sm:pt-16">
        <div className="relative z-10 mx-auto max-w-5xl space-y-4 sm:space-y-6">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-on-band/25 bg-on-band/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
            <span>{t('home.hero.badge')}</span>
          </p>

          <h1 className="hero-title text-balance text-3xl font-black leading-[1.1] tracking-tight xs:text-4xl sm:text-6xl md:text-7xl">
            {t('home.hero.title')}
          </h1>

          <p className="mx-auto max-w-2xl text-xs font-medium leading-relaxed text-on-band/75 sm:text-lg md:text-xl">
            {t('home.hero.subtitle', {
              regions: formatNumber(REGION_COUNT),
              districts: formatNumber(DISTRICT_COUNT),
            })}
          </p>
        </div>

        {/* Ambient brand glow — decorative only. */}
        <div
          className="pointer-events-none absolute right-0 top-0 hidden h-[350px] w-[350px] -translate-y-1/3 translate-x-1/3 rounded-full bg-brand/25 blur-3xl sm:block sm:h-[450px] sm:w-[450px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 hidden h-[350px] w-[350px] -translate-x-1/3 translate-y-1/3 rounded-full bg-brand/25 blur-3xl sm:block sm:h-[450px] sm:w-[450px]"
          aria-hidden="true"
        />
      </section>

      {/* Overlaps the hero band, which is why it carries its own stacking context. */}
      <div className="relative z-20 mx-auto -mt-8 max-w-3xl px-4 sm:-mt-10 sm:px-6">
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          aria-haspopup="dialog"
          aria-expanded={showSearchModal}
          className="group flex w-full items-center gap-3 rounded-full border border-line bg-surface p-3 shadow-raised transition-colors hover:bg-surface-2 sm:p-4"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition-transform group-hover:scale-105 sm:h-12 sm:w-12">
            <Search className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-black text-content sm:text-base">
              {t('home.hero.searchTitle')}
            </span>
            <span className="block truncate text-xs font-medium text-subtle">
              <span className="sm:hidden">{t('home.hero.searchHintShort')}</span>
              <span className="hidden sm:inline">{t('home.hero.searchHintLong')}</span>
            </span>
          </span>
        </button>
      </div>

      {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}
    </div>
  );
};

export default HeroSection;
