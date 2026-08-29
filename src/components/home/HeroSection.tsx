/**
 * The home hero.
 *
 * The dark band is painted with the inverse surface token rather than a fixed
 * slate, so the hero keeps its high-contrast look and still flips with the
 * theme instead of staying a black rectangle on a dark page.
 *
 * The coverage figures come from the shipped geography taxonomy, not from a
 * hand-written marketing number — and they now count the right things. The
 * old sentence said "14 viloyat va 151 tuman": fourteen is the number of
 * first-level units (twelve viloyats, plus Karakalpakstan, plus the city of
 * Tashkent), not of viloyats, and 151 was however many districts happened to
 * be listed in the data file. Both halves are derived below, and the data
 * file now holds the real division.
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { SearchModal } from './SearchModal';
import { QuickCategories } from './QuickCategories';

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const [showSearchModal, setShowSearchModal] = useState(false);

  return (
    <div className="w-full">
      <section className="gutter-safe relative overflow-hidden bg-gradient-to-b from-band to-band-2 pb-10 pt-5 text-center text-on-band sm:pb-14 sm:pt-8">
        <div className="relative z-10 mx-auto max-w-5xl space-y-5 sm:space-y-6">
          {/* 1. Category Cards at the top (exact match with design screenshot) */}
          <QuickCategories />

          {/* 2. Hero Title */}
          <h1 className="hero-title text-balance text-2xl font-black leading-tight tracking-tight text-white xs:text-3xl sm:text-5xl md:text-6xl pt-1 sm:pt-2">
            {t('home.hero.title')}
          </h1>

          {/* 3. Search Bar Button */}
          <div className="mx-auto max-w-3xl px-1">
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              aria-haspopup="dialog"
              aria-expanded={showSearchModal}
              className="press group flex w-full items-center gap-3 rounded-full border border-line bg-surface p-3 shadow-raised hover:bg-surface-2 sm:p-4 transition-all duration-300 hover:border-brand/40 hover:shadow-brand/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition-transform group-hover:scale-105 sm:h-11 sm:w-11 shadow-sm">
                <Search className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true" />
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
        </div>

        {/* Ambient brand glow — decorative only */}
        <div
          className="pointer-events-none absolute right-0 top-0 hidden h-[350px] w-[350px] -translate-y-1/3 translate-x-1/3 rounded-full bg-brand/25 blur-3xl sm:block sm:h-[450px] sm:w-[450px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 hidden h-[350px] w-[350px] -translate-x-1/3 translate-y-1/3 rounded-full bg-brand/25 blur-3xl sm:block sm:h-[450px] sm:w-[450px]"
          aria-hidden="true"
        />
      </section>

      <SearchModal open={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </div>
  );
};

export default HeroSection;
