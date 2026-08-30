/**
 * Top category cards matching the mobile design screenshot.
 *
 * Clean white cards with pastel-tinted icon containers and concise 1-word titles.
 */

import React, { useRef } from 'react';
import { ChevronRight } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';
import { quickFilterState, useAppStore, type QuickFilterId } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';

interface HomeCategory {
  id: Exclude<QuickFilterId, 'all'>;
  title: { uz: string; ru: string; en: string };
  /**
   * The category illustration from `public/img`.
   *
   * These replaced a set of lucide glyphs in tinted tiles. They are painted
   * artwork, not line icons: they carry their own colour, so the pastel tile
   * behind them was two backgrounds fighting for the same 44px. Sourced at
   * 256px for a 44px slot so they stay sharp on a 3x phone screen.
   */
  image: string;
  landing?: string;
}

const CATEGORIES: HomeCategory[] = [
  {
    id: 'roommate',
    landing: '/sheriklikka-ijara',
    title: { uz: 'Sheriklikka', ru: 'Совместно', en: 'Roommate' },
    image: '/img/sheriklika.webp',
  },
  {
    id: 'student',
    landing: '/talabalar-uchun-ijara',
    title: { uz: 'Talabalar', ru: 'Студентам', en: 'Students' },
    image: '/img/talaba.webp',
  },
  {
    id: 'family',
    landing: '/oilalar-uchun-ijara',
    title: { uz: 'Oilaviy', ru: 'Семейным', en: 'Family' },
    image: '/img/oila.webp',
  },
  {
    id: 'hovli',
    title: { uz: 'Hovli', ru: 'Дома', en: 'House' },
    image: '/img/hovli.webp',
  },
  {
    id: 'qizlarga',
    title: { uz: 'Qizlarga', ru: 'Девушкам', en: 'Girls' },
    image: '/img/qizlar.webp',
  },
  {
    id: 'komfort',
    title: { uz: 'Komfort', ru: 'Комфорт', en: 'Comfort' },
    image: '/img/qulay.webp',
  },
  {
    id: 'center',
    title: { uz: 'Markazda', ru: 'В центре', en: 'Center' },
    image: '/img/markaz.webp',
  },
  {
    id: 'metro',
    title: { uz: 'Metro', ru: 'У метро', en: 'Metro' },
    image: '/img/metro.webp',
  },
  {
    id: 'budget',
    landing: '/arzon-ijara',
    title: { uz: 'Arzon', ru: 'Недорого', en: 'Budget' },
    image: '/img/arzonroq.webp',
  },
  {
    id: 'premium',
    title: { uz: 'Ishonchli', ru: 'Надёжные', en: 'Verified' },
    image: '/img/ishonchli.webp',
  },
];

export const QuickCategories: React.FC = () => {
  const { language } = useTranslation();
  const haptics = useHaptics();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const scrollRef = useRef<HTMLUListElement>(null);

  const openCategory = (id: HomeCategory['id']) => {
    haptics.select();
    // Every card, including Hovli, reads the store's one quick-filter map:
    // the special case this replaces was a second definition of the same
    // search, and the catalogue's chip rail could not light up for it.
    setFilters(quickFilterState(id));
    setCurrentView('LISTINGS');
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 180, behavior: 'smooth' });
    }
  };

  const currentLang = (language === 'ru' || language === 'en') ? language : 'uz';

  return (
    <div className="relative w-full">
      {/*
        `py-4 -my-3` is padding the cards' entrance needs, taken straight back
        out again so the layout is unchanged. It nets to the 4px this had
        before.

        The reason it is here: `overflow-x: auto` forces the other axis to
        compute to `auto` as well, so this is a scroll container vertically too.
        The cards rise 16px into place, and without room to rise into, that
        16px is overflow — a vertical scrollbar appearing and vanishing on
        every load. The same room also stops the hover lift and the card
        shadows being clipped, which they were.
      */}
      <ul
        ref={scrollRef}
        className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto py-4 -my-3 hide-scrollbar snap-x snap-mandatory justify-start md:justify-center w-full px-1"
      >
        {CATEGORIES.map((category, index) => {
          const label = category.title[currentLang] || category.title.uz;

          const inner = (
            <>
              <img
                src={category.image}
                alt=""
                aria-hidden="true"
                width={74}
                height={74}
                /* The rail sits above the hero, so every one of these is in the
                   first viewport. Lazy-loading them made the ten cards paint empty
                   and fill in a beat later. Eager, but deliberately not
                   fetchPriority="high": ten 17KB images should not outrank the
                   hero text for bandwidth. */
                loading="eager"
                decoding="async"
                className="h-[54px] w-[54px] shrink-0 select-none object-contain transition-transform duration-200 group-hover:scale-105 xs:h-[58px] xs:w-[58px] sm:h-[66px] sm:w-[66px] lg:h-[74px] lg:w-[74px]"
              />

              <span className="mt-1 block w-full truncate text-[11px] sm:text-xs lg:text-[13px] font-black text-slate-800 dark:text-content text-center leading-none">
                {label}
              </span>
            </>
          );

          const cardClass =
            'press group flex flex-col items-center justify-center shrink-0 ' +
            'w-[84px] xs:w-[92px] sm:w-[104px] lg:w-[116px] h-[104px] xs:h-[112px] sm:h-[122px] lg:h-[134px] ' +
            'rounded-2xl bg-white dark:bg-surface text-slate-800 dark:text-content ' +
            'shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 ' +
            'transition-all duration-200 cursor-pointer snap-start border border-white/40 dark:border-line';

          return (
            <li
              key={category.id}
              /* The stagger is the card's index, read by `.hero-card-in` in
                 index.css. Inline because it is per-item data, and it ships in
                 the server-rendered HTML so the first painted frame already
                 has the card in its `from` state. */
              className="hero-card-in shrink-0"
              style={{ '--i': index } as React.CSSProperties}
            >
              {category.landing ? (
                <AppLink
                  to={category.landing}
                  onClick={() => haptics.select()}
                  className={cardClass}
                >
                  {inner}
                </AppLink>
              ) : (
                <button
                  type="button"
                  onClick={() => openCategory(category.id)}
                  className={cardClass}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Floating right scroll button for mobile */}
      <button
        type="button"
        onClick={scrollRight}
        aria-label="Scroll categories right"
        className="absolute -right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 dark:bg-surface shadow-md text-slate-700 dark:text-content hover:bg-white hover:scale-105 active:scale-95 transition-all z-10 md:hidden border border-slate-200/60"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default QuickCategories;


