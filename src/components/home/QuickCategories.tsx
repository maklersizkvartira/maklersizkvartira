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
  /**
   * The landing page whose facet is this card's search, where one exists.
   *
   * A card earns one only when the route filters by exactly what the card
   * filters by, because the link is a promise about the result set: `qizlarga`
   * (roommateGender), `komfort` (amenities), `metro` (metroStation) and
   * `premium` (trust) have no page that keeps it, and pointing them at a
   * broader one would widen the search on the way. Where the promise holds the
   * card ships as an `<a href>` — the only form of it a crawler can follow out
   * of the home page, which otherwise passes authority to four categories and
   * nothing else.
   */
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
    landing: '/uy-ijaraga',
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
    /* "The centre" is Mirobod and nothing else — the district hub is the same
       result set with the prose and the neighbouring districts around it, and
       it is the only district the root links to at all. */
    landing: '/toshkent/mirobod',
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
  const { t, language } = useTranslation();
  const haptics = useHaptics();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const scrollRef = useRef<HTMLUListElement>(null);

  /*
   * The rail used to scroll itself, two cards every three seconds.
   *
   * It is the first thing above the fold on a phone, and the pause it offered
   * did not work there: `onMouseEnter` never fires on a touch screen, and the
   * touch pause expired by itself four seconds later — so a reader who had
   * stopped the rail to read a card had it move again while they were still
   * reading, and a thumb resting on a tile got a different tile under it. It
   * ignored `prefers-reduced-motion` as well.
   *
   * That is WCAG 2.2.2 (Pause, Stop, Hide) failed twice over, and it is the
   * exact behaviour the listings rail one component away had removed for the
   * same reasons. The rail is swipeable and has a scroll button; nothing here
   * needed to move on its own.
   */

  const openCategory = (id: HomeCategory['id']) => {
    haptics.select();
    // See the identical call in Header.tsx: `quickFilterState` carries the
    // live search and deal type across on purpose, and calling it bare fires
    // both defaults instead — silently resetting the deal type and throwing
    // away whatever the visitor had typed.
    const { search, dealType } = useAppStore.getState().filters;
    setFilters(quickFilterState(id, search, dealType), { quickFilter: id });
    setCurrentView('LISTINGS');
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const currentLang = (language === 'ru' || language === 'en') ? language : 'uz';

  return (
    <div className="relative w-full">
      <ul
        ref={scrollRef}
        className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto py-4 -my-3 hide-scrollbar snap-x snap-mandatory justify-start lg:justify-center w-full px-1 scroll-smooth"
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

      {/* The phone-only nudge to the right of the rail.

          Three things were wrong with it: the label was hardcoded English on a
          site whose default language is Uzbek, the target was 28px on the one
          device it is drawn for, and the border was a raw palette literal with
          no dark-mode counterpart, so it stayed light-grey against the dark
          surface. The glyph keeps its size; the touch target grows around it. */}
      <button
        type="button"
        onClick={scrollRight}
        aria-label={t('common.a11y.scrollRight')}
        className="press absolute -right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-content shadow-md transition-transform active:scale-95 md:hidden"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default QuickCategories;


