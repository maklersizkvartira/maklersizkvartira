/**
 * Top category cards matching the mobile design screenshot.
 *
 * Clean white cards with pastel-tinted icon containers and concise 1-word titles.
 */

import React, { useRef } from 'react';
import {
  ChevronRight,
  Flower2,
  GraduationCap,
  Handshake,
  Home,
  Landmark,
  ShieldCheck,
  Sofa,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import { useHaptics } from '../../hooks/useHaptics';
import { quickFilterState, useAppStore, type QuickFilterId, DEFAULT_FILTERS } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';

interface HomeCategory {
  id: Exclude<QuickFilterId, 'all'> | 'house';
  title: { uz: string; ru: string; en: string };
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  landing?: string;
}

const CATEGORIES: HomeCategory[] = [
  {
    id: 'roommate',
    landing: '/sheriklikka-ijara',
    title: { uz: 'Sheriklikka', ru: 'Совместно', en: 'Roommate' },
    icon: Handshake,
    tone: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  },
  {
    id: 'student',
    landing: '/talabalar-uchun-ijara',
    title: { uz: 'Talabalar', ru: 'Студентам', en: 'Students' },
    icon: GraduationCap,
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  },
  {
    id: 'family',
    landing: '/oilalar-uchun-ijara',
    title: { uz: 'Oilaviy', ru: 'Семейным', en: 'Family' },
    icon: Users,
    tone: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
  },
  {
    id: 'house',
    title: { uz: 'Hovli', ru: 'Дома', en: 'House' },
    icon: Home,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  {
    id: 'qizlarga',
    title: { uz: 'Qizlarga', ru: 'Девушкам', en: 'Girls' },
    icon: Flower2,
    tone: 'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400',
  },
  {
    id: 'komfort',
    title: { uz: 'Komfort', ru: 'Комфорт', en: 'Comfort' },
    icon: Sofa,
    tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
  },
  {
    id: 'center',
    title: { uz: 'Markazda', ru: 'В центре', en: 'Center' },
    icon: Landmark,
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
  },
  {
    id: 'metro',
    title: { uz: 'Metro', ru: 'У метро', en: 'Metro' },
    icon: TrainFront,
    tone: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
  },
  {
    id: 'budget',
    landing: '/arzon-ijara',
    title: { uz: 'Arzon', ru: 'Недорого', en: 'Budget' },
    icon: TrendingDown,
    tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
  },
  {
    id: 'premium',
    title: { uz: 'Ishonchli', ru: 'Надёжные', en: 'Verified' },
    icon: ShieldCheck,
    tone: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400',
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
    if (id === 'house') {
      setFilters({ ...DEFAULT_FILTERS, propertyType: 'HOUSE' });
    } else {
      setFilters(quickFilterState(id));
    }
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
      <ul
        ref={scrollRef}
        className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-1 pt-1 hide-scrollbar snap-x snap-mandatory justify-start md:justify-center w-full px-1"
      >
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const label = category.title[currentLang] || category.title.uz;

          const inner = (
            <>
              <span
                className={cn(
                  'flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
                  category.tone,
                )}
              >
                <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" aria-hidden="true" />
              </span>

              <span className="mt-1 block w-full truncate text-[11px] sm:text-xs font-black text-slate-800 dark:text-content text-center leading-none">
                {label}
              </span>
            </>
          );

          const cardClass =
            'press group flex flex-col items-center justify-center shrink-0 ' +
            'w-[76px] xs:w-[84px] sm:w-[92px] h-[78px] xs:h-[84px] sm:h-[90px] ' +
            'rounded-2xl bg-white dark:bg-surface text-slate-800 dark:text-content ' +
            'shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 ' +
            'transition-all duration-200 cursor-pointer snap-start border border-white/40 dark:border-line';

          return (
            <li key={category.id} className="shrink-0">
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


