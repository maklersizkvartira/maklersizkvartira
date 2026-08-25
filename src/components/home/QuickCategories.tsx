/**
 * The six shortcut categories.
 *
 * Titles and descriptions come from `layout.categories.*` — the header
 * dropdown shows the same six sections, and a second copy of the strings
 * would drift the moment one of them is reworded.
 *
 * Each card commits a full filter set (defaults + its own patch) in a single
 * `setFilters` call, because reset-then-patch would fire two list requests.
 */

import React from 'react';
import {
  ArrowRight,
  GraduationCap,
  Handshake,
  ShieldCheck,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { DEFAULT_FILTERS, useAppStore, type Filters } from '../../stores/useAppStore';

interface HomeCategory {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  tagKeys: readonly [TranslationKey, TranslationKey];
  icon: React.ComponentType<{ className?: string }>;
  /** Icon micro-animation, chosen per category to hint at what it does. */
  iconMotion: string;
  tone: string;
  patch: Partial<Filters>;
}

const CATEGORIES: HomeCategory[] = [
  {
    id: 'roommate',
    titleKey: 'layout.categories.roommate.title',
    descriptionKey: 'layout.categories.roommate.description',
    tagKeys: ['home.categories.tags.roommateBoys', 'home.categories.tags.roommateGirls'],
    icon: Handshake,
    iconMotion: 'group-hover:scale-110',
    tone: 'bg-warning-soft text-warning',
    patch: { rentalType: 'ROOMMATE' },
  },
  {
    id: 'student',
    titleKey: 'layout.categories.student.title',
    descriptionKey: 'layout.categories.student.description',
    tagKeys: [
      'home.categories.tags.studentNearUniversity',
      'home.categories.tags.studentDormAlternative',
    ],
    icon: GraduationCap,
    iconMotion: 'group-hover:-rotate-12',
    tone: 'bg-info-soft text-info',
    patch: { audience: 'STUDENT' },
  },
  {
    id: 'family',
    titleKey: 'layout.categories.family.title',
    descriptionKey: 'layout.categories.family.description',
    tagKeys: ['home.categories.tags.familyTwoRooms', 'home.categories.tags.familyThreeRooms'],
    icon: Users,
    iconMotion: 'group-hover:rotate-6',
    tone: 'bg-brand-soft text-brand-text',
    patch: { audience: 'FAMILY', rentalType: 'FULL', rooms: 2 },
  },
  {
    id: 'metro',
    titleKey: 'layout.categories.metro.title',
    descriptionKey: 'layout.categories.metro.description',
    tagKeys: ['home.categories.tags.metroWalk', 'home.categories.tags.metroCentral'],
    icon: TrainFront,
    iconMotion: 'group-hover:translate-x-1',
    tone: 'bg-info-soft text-info',
    // The API has no "near any metro" flag, so the shortcut opens the busiest
    // interchange and leaves the station dropdown for the rest.
    patch: { metroStation: 'Yunusobod' },
  },
  {
    id: 'budget',
    titleKey: 'layout.categories.budget.title',
    descriptionKey: 'layout.categories.budget.description',
    tagKeys: ['home.categories.tags.budgetNoDeposit', 'home.categories.tags.budgetLowPrice'],
    icon: TrendingDown,
    iconMotion: 'group-hover:translate-y-0.5',
    tone: 'bg-danger-soft text-danger',
    // Matches the "up to 3 mln" promise in the shared category description.
    patch: { maxPrice: 3_000_000, sortBy: 'PRICE_LOW' },
  },
  {
    id: 'premium',
    titleKey: 'layout.categories.premium.title',
    descriptionKey: 'layout.categories.premium.description',
    tagKeys: [
      'home.categories.tags.premiumVerifiedOwner',
      'home.categories.tags.premiumHighTrust',
    ],
    icon: ShieldCheck,
    iconMotion: 'group-hover:scale-110',
    tone: 'bg-brand-soft-2 text-brand-text',
    patch: { onlyVerified: true, minTrustScore: 80, sortBy: 'TRUST' },
  },
];

export const QuickCategories: React.FC = () => {
  const { t } = useTranslation();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const openCategory = (patch: Partial<Filters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    setCurrentView('LISTINGS');
  };

  return (
    <section
      id="kategoriyalar"
      aria-labelledby="home-categories-title"
      className="mx-auto max-w-7xl space-y-6 px-0 py-8 sm:px-6 sm:py-14"
    >
      <div className="flex flex-col justify-between gap-3 px-4 pb-2 sm:flex-row sm:items-end sm:px-0">
        <div>
          <h2
            id="home-categories-title"
            className="text-2xl font-black tracking-tight text-content sm:text-4xl"
          >
            {t('home.categories.title')}
          </h2>
          <p className="mt-1 text-xs font-medium text-subtle sm:text-sm">
            {t('home.categories.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('LISTINGS')}
          className="group inline-flex items-center gap-2 self-start rounded-2xl bg-brand px-4 py-2.5 text-xs font-extrabold text-on-brand shadow-brand transition-colors hover:bg-brand-hover sm:self-auto sm:text-sm"
        >
          <span>{t('home.categories.viewAll')}</span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </button>
      </div>

      <ul className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:px-0">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          return (
            <li key={category.id} className="flex w-[140px] shrink-0 snap-start sm:w-[160px]">
              <button
                type="button"
                onClick={() => openCategory(category.patch)}
                className="group relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface p-4 text-center transition-all duration-300 hover:border-brand hover:shadow-card"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line transition-transform duration-300 group-hover:scale-105 ${category.tone}`}
                >
                  <Icon className={`h-6 w-6 transition-transform duration-300 ${category.iconMotion}`} />
                </span>

                <span className="min-w-0 w-full">
                  <span className="block truncate text-[13px] font-black text-content transition-colors group-hover:text-brand-text">
                    {t(category.titleKey)}
                  </span>
                  <span className="mt-1 hidden text-[11px] font-medium leading-snug text-subtle sm:block">
                    {t(category.descriptionKey)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default QuickCategories;
