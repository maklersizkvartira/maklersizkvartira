/**
 * The top shortcut categories bar.
 *
 * Modern, icon-first category buttons placed right under the main search bar.
 */

import React from 'react';
import {
  Flower2,
  GraduationCap,
  Handshake,
  Landmark,
  ShieldCheck,
  Sofa,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { useHaptics } from '../../hooks/useHaptics';
import { quickFilterState, useAppStore, type QuickFilterId } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';

interface HomeCategory {
  id: Exclude<QuickFilterId, 'all'>;
  titleKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  glow: string;
  landing?: string;
}

const CATEGORIES: HomeCategory[] = [
  {
    id: 'roommate',
    landing: '/sheriklikka-ijara',
    titleKey: 'layout.categories.roommate.title',
    icon: Handshake,
    tone: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white',
    glow: 'from-amber-500/25',
  },
  {
    id: 'student',
    landing: '/talabalar-uchun-ijara',
    titleKey: 'layout.categories.student.title',
    icon: GraduationCap,
    tone: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white',
    glow: 'from-blue-500/25',
  },
  {
    id: 'family',
    landing: '/oilalar-uchun-ijara',
    titleKey: 'layout.categories.family.title',
    icon: Users,
    tone: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white',
    glow: 'from-emerald-500/25',
  },
  {
    id: 'qizlarga',
    titleKey: 'layout.categories.qizlarga.title',
    icon: Flower2,
    tone: 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400 border-pink-500/20 group-hover:bg-pink-500 group-hover:text-white',
    glow: 'from-pink-500/25',
  },
  {
    id: 'komfort',
    titleKey: 'layout.categories.komfort.title',
    icon: Sofa,
    tone: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white',
    glow: 'from-indigo-500/25',
  },
  {
    id: 'center',
    titleKey: 'layout.categories.center.title',
    icon: Landmark,
    tone: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white',
    glow: 'from-orange-500/25',
  },
  {
    id: 'metro',
    titleKey: 'layout.categories.metro.title',
    icon: TrainFront,
    tone: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white',
    glow: 'from-cyan-500/25',
  },
  {
    id: 'budget',
    landing: '/arzon-ijara',
    titleKey: 'layout.categories.budget.title',
    icon: TrendingDown,
    tone: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border-teal-500/20 group-hover:bg-teal-500 group-hover:text-white',
    glow: 'from-teal-500/25',
  },
  {
    id: 'premium',
    titleKey: 'layout.categories.premium.title',
    icon: ShieldCheck,
    tone: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-500/20 group-hover:bg-purple-500 group-hover:text-white',
    glow: 'from-purple-500/25',
  },
];

export const QuickCategories: React.FC = () => {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const openCategory = (id: HomeCategory['id']) => {
    haptics.select();
    setFilters(quickFilterState(id));
    setCurrentView('LISTINGS');
  };

  return (
    <div className="w-full pt-1">
      <ul className="flex overflow-x-auto gap-2 sm:gap-2.5 pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-9 hide-scrollbar snap-x snap-mandatory justify-start sm:justify-center">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const inner = (
            <>
              {/* Glow effect on hover */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b to-transparent opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100',
                  category.glow,
                )}
              />

              <span
                className={cn(
                  'relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-md',
                  category.tone,
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300" />
              </span>

              <span className="relative block w-full truncate text-[11px] sm:text-xs font-extrabold text-content transition-colors group-hover:text-brand-text">
                {t(category.titleKey)}
              </span>
            </>
          );

          const itemClass =
            'press group relative flex flex-col items-center justify-center gap-1.5 ' +
            'rounded-2xl border border-line/70 bg-surface/90 p-2 sm:p-2.5 text-center backdrop-blur-md ' +
            'transition-all duration-300 hover:-translate-y-1 hover:border-brand/50 hover:bg-surface ' +
            'hover:shadow-raised active:scale-95 shrink-0 w-[78px] xs:w-[84px] sm:w-auto cursor-pointer snap-start';

          return (
            <li key={category.id} className="min-w-0">
              {category.landing ? (
                <AppLink to={category.landing} onClick={() => haptics.select()} className={itemClass}>
                  {inner}
                </AppLink>
              ) : (
                <button type="button" onClick={() => openCategory(category.id)} className={itemClass}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default QuickCategories;

