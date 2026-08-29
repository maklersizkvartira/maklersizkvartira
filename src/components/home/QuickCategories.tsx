/**
 * The shortcut categories.
 *
 * Titles and descriptions come from `layout.categories.*` — the header
 * dropdown shows the same sections, and a second copy of the strings would
 * drift the moment one of them is reworded.
 *
 * Each card commits a full filter set (defaults + its own patch) in a single
 * `setFilters` call, because reset-then-patch would fire two list requests.
 *
 * There are nine of them now, which is what ended the horizontal rail: nine
 * tiles in a rail means six of them live off the right edge of a phone, and
 * the three that are visible are the three nobody chose. A two-column grid
 * shows six without a scroll and the last three one thumb-flick away.
 */

import React from 'react';
import {
  ArrowRight,
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
import { VIEW_PATHS } from '../../router/views';

/**
 * What each card opens is not defined here.
 *
 * `QUICK_FILTER_DELTAS` in the store is the one definition of "what 'for
 * families' means", and the catalogue's chips read the same map. When the two
 * had their own literals they had already drifted — the card set `rooms: 2`
 * and the chip did not — so the same word gave two different result counts
 * depending on where you tapped it.
 */
interface HomeCategory {
  /** Names a delta in the store's quick-filter map. */
  id: Exclude<QuickFilterId, 'all'>;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  tagKeys: readonly [TranslationKey, TranslationKey];
  icon: React.ComponentType<{ className?: string }>;
  /** Icon micro-animation, chosen per category to hint at what it does. */
  iconMotion: string;
  /** The icon tile. */
  tone: string;
  /** The corner wash behind it — the gradient's `from-` stop. */
  wash: string;
  /**
   * The landing page this shortcut belongs to, when there is one.
   *
   * These cards used to commit a filter and swap the view, so six of the
   * site's most prominent entry points led to the same URL and passed no
   * signal to the pages built for exactly those searches. The five without a
   * landing page have no keyword worth a page of their own and keep the old
   * filter behaviour.
   */
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
    iconMotion: 'group-hover:scale-110',
    tone: 'bg-warning-soft text-warning',
    wash: 'from-warning/25',
  },
  {
    id: 'student',
    landing: '/talabalar-uchun-ijara',
    titleKey: 'layout.categories.student.title',
    descriptionKey: 'layout.categories.student.description',
    tagKeys: [
      'home.categories.tags.studentNearUniversity',
      'home.categories.tags.studentDormAlternative',
    ],
    icon: GraduationCap,
    iconMotion: 'group-hover:-rotate-12',
    tone: 'bg-info-soft text-info',
    wash: 'from-info/25',
  },
  {
    id: 'family',
    landing: '/oilalar-uchun-ijara',
    titleKey: 'layout.categories.family.title',
    descriptionKey: 'layout.categories.family.description',
    tagKeys: ['home.categories.tags.familyTwoRooms', 'home.categories.tags.familyThreeRooms'],
    icon: Users,
    iconMotion: 'group-hover:rotate-6',
    tone: 'bg-brand-soft text-brand-text',
    wash: 'from-brand/25',
  },
  {
    id: 'qizlarga',
    titleKey: 'layout.categories.qizlarga.title',
    descriptionKey: 'layout.categories.qizlarga.description',
    tagKeys: ['home.categories.tags.qizlargaOnlyGirls', 'home.categories.tags.qizlargaRoommate'],
    icon: Flower2,
    iconMotion: 'group-hover:rotate-12',
    tone: 'bg-danger-soft text-danger',
    wash: 'from-danger/25',
  },
  {
    id: 'komfort',
    titleKey: 'layout.categories.komfort.title',
    descriptionKey: 'layout.categories.komfort.description',
    tagKeys: ['home.categories.tags.komfortFurnished', 'home.categories.tags.komfortAppliances'],
    icon: Sofa,
    iconMotion: 'group-hover:-translate-y-0.5',
    tone: 'bg-success-soft text-success',
    wash: 'from-success/25',
  },
  {
    id: 'center',
    titleKey: 'layout.categories.center.title',
    descriptionKey: 'layout.categories.center.description',
    tagKeys: ['home.categories.tags.centerWalkable', 'home.categories.tags.centerDistricts'],
    icon: Landmark,
    iconMotion: 'group-hover:scale-110',
    tone: 'bg-brand-soft-2 text-brand-text',
    wash: 'from-brand/20',
  },
  {
    id: 'metro',
    titleKey: 'layout.categories.metro.title',
    descriptionKey: 'layout.categories.metro.description',
    tagKeys: ['home.categories.tags.metroWalk', 'home.categories.tags.metroCentral'],
    icon: TrainFront,
    iconMotion: 'group-hover:translate-x-1',
    tone: 'bg-info-soft text-info',
    wash: 'from-info/20',
  },
  {
    id: 'budget',
    landing: '/arzon-ijara',
    titleKey: 'layout.categories.budget.title',
    descriptionKey: 'layout.categories.budget.description',
    tagKeys: ['home.categories.tags.budgetNoDeposit', 'home.categories.tags.budgetLowPrice'],
    icon: TrendingDown,
    iconMotion: 'group-hover:translate-y-0.5',
    tone: 'bg-danger-soft text-danger',
    wash: 'from-danger/20',
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
    tone: 'bg-brand-soft text-brand-text',
    wash: 'from-brand/20',
  },
];

const cardClass =
  'press group relative flex h-full w-full flex-col gap-2 overflow-hidden rounded-2xl ' +
  'border border-line bg-surface p-2.5 text-left transition-all duration-300 ' +
  'hover:-translate-y-1 hover:border-brand/40 hover:shadow-raised sm:gap-3 sm:p-4 sm:rounded-3xl';

export const QuickCategories: React.FC = () => {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const openCategory = (id: HomeCategory['id']) => {
    haptics.select();
    // A whole filter set in one commit: reset-then-patch would fire two list
    // requests, and patching alone would leave the previous card's audience
    // standing next to this card's rental type.
    setFilters(quickFilterState(id));
    setCurrentView('LISTINGS');
  };

  return (
    <section
      id="kategoriyalar"
      aria-labelledby="home-categories-title"
      className="gutter-safe mx-auto max-w-7xl space-y-5 py-8 sm:py-14"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
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

        <AppLink
          to={VIEW_PATHS.LISTINGS ?? '/elonlar'}
          className="press group inline-flex items-center gap-2 self-start rounded-2xl bg-brand px-4 py-2.5 text-xs font-extrabold text-on-brand shadow-brand hover:bg-brand-hover sm:self-auto sm:text-sm"
        >
          <span>{t('home.categories.viewAll')}</span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </AppLink>
      </div>

      <ul className="flex overflow-x-auto gap-2.5 pb-2 -mx-4 px-4 snap-x snap-mandatory hide-scrollbar sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-3 sm:gap-4">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const inner = (
            <>
              {/* The accent wash. Decorative, and behind everything else, which
                  is why every real child below carries `relative`. */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full',
                  'bg-gradient-to-br to-transparent opacity-60 blur-2xl',
                  'transition-opacity duration-300 group-hover:opacity-100',
                  category.wash,
                )}
              />

              <span
                className={cn(
                  'relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl',
                  'border border-line/60 transition-transform duration-300 group-hover:scale-105',
                  category.tone,
                )}
              >
                <Icon
                  className={cn('h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300', category.iconMotion)}
                />
              </span>

              <span className="relative block min-w-0">
                <span className="block truncate text-xs sm:text-sm font-black text-content transition-colors group-hover:text-brand-text">
                  {t(category.titleKey)}
                </span>
                <span className="mt-0.5 line-clamp-1 sm:line-clamp-2 block text-[10px] sm:text-[11px] font-medium leading-snug text-subtle">
                  {t(category.descriptionKey)}
                </span>
              </span>

              {/* The tags */}
              <span className="relative mt-auto flex flex-wrap gap-1 pt-0.5">
                {category.tagKeys.map((tagKey) => (
                  <span
                    key={tagKey}
                    className="max-w-full truncate rounded-full bg-surface-2 px-1.5 py-0.5 sm:px-2 text-[9px] sm:text-[10px] font-bold text-muted"
                  >
                    {t(tagKey)}
                  </span>
                ))}
              </span>
            </>
          );

          return (
            <li key={category.id} className="min-w-0 shrink-0 w-[148px] snap-start sm:w-auto sm:shrink">
              {category.landing ? (
                <AppLink to={category.landing} onClick={() => haptics.select()} className={cardClass}>
                  {inner}
                </AppLink>
              ) : (
                <button type="button" onClick={() => openCategory(category.id)} className={cardClass}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default QuickCategories;
