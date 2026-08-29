/**
 * The top shortcut categories bar.
 *
 * Provides a prominent "Kategoriyalar" button that opens an animated modal sheet
 * plus quick horizontal chips placed right under the search bar.
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Flower2,
  GraduationCap,
  Handshake,
  Landmark,
  LayoutGrid,
  ShieldCheck,
  Sofa,
  Sparkles,
  TrainFront,
  TrendingDown,
  Users,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { useHaptics } from '../../hooks/useHaptics';
import { quickFilterState, useAppStore, type QuickFilterId } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';
import { Sheet } from '../ui/Sheet';

interface HomeCategory {
  id: Exclude<QuickFilterId, 'all'>;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  tagKeys: readonly [TranslationKey, TranslationKey];
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
    descriptionKey: 'layout.categories.roommate.description',
    tagKeys: ['home.categories.tags.roommateBoys', 'home.categories.tags.roommateGirls'],
    icon: Handshake,
    tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    glow: 'from-amber-500/20',
  },
  {
    id: 'student',
    landing: '/talabalar-uchun-ijara',
    titleKey: 'layout.categories.student.title',
    descriptionKey: 'layout.categories.student.description',
    tagKeys: ['home.categories.tags.studentNearUniversity', 'home.categories.tags.studentDormAlternative'],
    icon: GraduationCap,
    tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    glow: 'from-blue-500/20',
  },
  {
    id: 'family',
    landing: '/oilalar-uchun-ijara',
    titleKey: 'layout.categories.family.title',
    descriptionKey: 'layout.categories.family.description',
    tagKeys: ['home.categories.tags.familyTwoRooms', 'home.categories.tags.familyThreeRooms'],
    icon: Users,
    tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    glow: 'from-emerald-500/20',
  },
  {
    id: 'qizlarga',
    titleKey: 'layout.categories.qizlarga.title',
    descriptionKey: 'layout.categories.qizlarga.description',
    tagKeys: ['home.categories.tags.qizlargaOnlyGirls', 'home.categories.tags.qizlargaRoommate'],
    icon: Flower2,
    tone: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/20',
    glow: 'from-pink-500/20',
  },
  {
    id: 'komfort',
    titleKey: 'layout.categories.komfort.title',
    descriptionKey: 'layout.categories.komfort.description',
    tagKeys: ['home.categories.tags.komfortFurnished', 'home.categories.tags.komfortAppliances'],
    icon: Sofa,
    tone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    glow: 'from-indigo-500/20',
  },
  {
    id: 'center',
    titleKey: 'layout.categories.center.title',
    descriptionKey: 'layout.categories.center.description',
    tagKeys: ['home.categories.tags.centerWalkable', 'home.categories.tags.centerDistricts'],
    icon: Landmark,
    tone: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
    glow: 'from-orange-500/20',
  },
  {
    id: 'metro',
    titleKey: 'layout.categories.metro.title',
    descriptionKey: 'layout.categories.metro.description',
    tagKeys: ['home.categories.tags.metroWalk', 'home.categories.tags.metroCentral'],
    icon: TrainFront,
    tone: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    glow: 'from-cyan-500/20',
  },
  {
    id: 'budget',
    landing: '/arzon-ijara',
    titleKey: 'layout.categories.budget.title',
    descriptionKey: 'layout.categories.budget.description',
    tagKeys: ['home.categories.tags.budgetNoDeposit', 'home.categories.tags.budgetLowPrice'],
    icon: TrendingDown,
    tone: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
    glow: 'from-teal-500/20',
  },
  {
    id: 'premium',
    titleKey: 'layout.categories.premium.title',
    descriptionKey: 'layout.categories.premium.description',
    tagKeys: ['home.categories.tags.premiumVerifiedOwner', 'home.categories.tags.premiumHighTrust'],
    icon: ShieldCheck,
    tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20',
    glow: 'from-purple-500/20',
  },
];

export const QuickCategories: React.FC = () => {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openCategory = (id: HomeCategory['id']) => {
    haptics.select();
    setSheetOpen(false);
    setFilters(quickFilterState(id));
    setCurrentView('LISTINGS');
  };

  return (
    <div className="w-full">
      {/* Top category strip under search bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 hide-scrollbar">
        {/* Main "Kategoriyalar" trigger button */}
        <button
          type="button"
          onClick={() => {
            haptics.select();
            setSheetOpen(true);
          }}
          className="press group inline-flex shrink-0 items-center gap-2 rounded-2xl bg-brand px-3.5 py-2.5 text-xs font-black text-on-brand shadow-brand hover:bg-brand-hover active:scale-95 transition-all"
        >
          <LayoutGrid className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden="true" />
          <span>{t('layout.categories.label')}</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1 text-[10px] font-black">
            {CATEGORIES.length}
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-80 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>

        {/* Quick horizontal category chips */}
        <div className="flex items-center gap-2">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const chipContent = (
              <>
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border',
                    category.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{t(category.titleKey)}</span>
              </>
            );

            const chipClass =
              'press group inline-flex shrink-0 items-center gap-2 rounded-2xl border border-line ' +
              'bg-surface px-3 py-2 text-xs font-bold text-content shadow-xs transition-all ' +
              'hover:border-brand/40 hover:bg-surface-2 hover:text-brand-text active:scale-95 cursor-pointer';

            return category.landing ? (
              <AppLink
                key={category.id}
                to={category.landing}
                onClick={() => haptics.select()}
                className={chipClass}
              >
                {chipContent}
              </AppLink>
            ) : (
              <button
                key={category.id}
                type="button"
                onClick={() => openCategory(category.id)}
                className={chipClass}
              >
                {chipContent}
              </button>
            );
          })}
        </div>
      </div>

      {/* Beautiful Animated Categories Modal Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('home.categories.title')}
        description={t('home.categories.subtitle')}
        size="lg"
      >
        <div className="py-2">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const cardInner = (
                <>
                  {/* Decorative glow */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent opacity-40 blur-xl transition-opacity duration-300 group-hover:opacity-80',
                      category.glow,
                    )}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-300 group-hover:scale-110',
                          category.tone,
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-content transition-colors group-hover:text-brand-text">
                          {t(category.titleKey)}
                        </h4>
                        <p className="mt-0.5 text-xs text-subtle leading-snug line-clamp-2">
                          {t(category.descriptionKey)}
                        </p>
                      </div>
                    </div>

                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-all group-hover:bg-brand group-hover:text-on-brand group-hover:translate-x-0.5">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="relative mt-3 flex flex-wrap gap-1.5 pt-1 border-t border-line/50">
                    {category.tagKeys.map((tagKey) => (
                      <span
                        key={tagKey}
                        className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-bold text-muted border border-line/60"
                      >
                        {t(tagKey)}
                      </span>
                    ))}
                  </div>
                </>
              );

              const cardClass =
                'press group relative flex flex-col justify-between overflow-hidden rounded-2xl ' +
                'border border-line bg-surface-2/70 p-3.5 text-left transition-all duration-300 ' +
                'hover:border-brand/40 hover:bg-surface hover:shadow-raised active:scale-[0.98] cursor-pointer';

              return (
                <li key={category.id}>
                  {category.landing ? (
                    <AppLink
                      to={category.landing}
                      onClick={() => {
                        haptics.select();
                        setSheetOpen(false);
                      }}
                      className={cardClass}
                    >
                      {cardInner}
                    </AppLink>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCategory(category.id)}
                      className={cardClass}
                    >
                      {cardInner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Sheet>
    </div>
  );
};

export default QuickCategories;


