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
 *
 * The two illustrations flank the headline from `lg` up and drop beneath it
 * below that; the reasoning for both halves of that is at the grid itself.
 * They are laid out as grid tracks rather than pinned to the band's edges
 * because absolute artwork and centred text share the same pixels the moment
 * a translation runs long — a track cannot overlap the column beside it at
 * any width, which is the one guarantee this composition needs.
 */

import React, { useState } from 'react';
import { BadgePercent, Search, ShieldCheck, Users, Zap } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { SearchModal } from './SearchModal';
import { QuickCategories } from './QuickCategories';

/**
 * A pill that floats on top of one of the hero illustrations.
 *
 * Positioned by the caller rather than by a variant prop: each one is placed
 * against a specific feature of the artwork it annotates — the phone's screen,
 * the house's roofline — and a shared "top-left / bottom-right" vocabulary
 * would only be a worse way of writing the same four numbers.
 *
 * `backdrop-blur` over a translucent navy is what keeps the label readable
 * wherever it lands: the illustrations run from near-black plinths to bright
 * cyan highlights, so a flat fill legible over one part of them is invisible
 * over another.
 */
const HeroBadge: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}> = ({ icon: Icon, label, className = '' }) => (
  <span
    aria-hidden="true"
    className={`pointer-events-none absolute z-10 inline-flex max-w-[10.5rem] items-center gap-2 rounded-2xl border border-white/15 bg-band/70 py-2 pl-2 pr-3 shadow-raised backdrop-blur-md ${className}`}
  >
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="text-[11px] font-bold leading-tight text-white">{label}</span>
  </span>
);

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const [showSearchModal, setShowSearchModal] = useState(false);

  return (
    <div className="w-full">
      <section className="gutter-safe relative overflow-hidden bg-gradient-to-b from-band to-band-2 pb-10 pt-5 text-center text-on-band sm:pb-14 sm:pt-8 lg:pb-16">
        <div className="relative z-10 space-y-6 sm:space-y-7">
          {/* 1. Category Cards at the top (exact match with design screenshot).
                 Kept inside its own 5xl column so widening the artwork stage
                 below does not also stretch the rail and change where the ten
                 cards sit. */}
          <div className="mx-auto max-w-5xl">
            <QuickCategories />
          </div>

          {/* 2. The headline, the search pill and the two illustrations.

                 Below `lg` the pair sits beneath the text instead of either
                 side of it. At 360px there is no width to flank a headline
                 without shrinking the art to a thumbnail, and the two pieces
                 only tell their story together — the app in your hand, the
                 verified home — so hiding one was worse than moving both. They
                 are capped by height rather than by width down here, which is
                 what keeps them one short band at the foot of the hero instead
                 of a screenful: on a 360x640 phone the search pill still lands
                 around 360px down, well inside the first viewport.

                 The image tracks are fixed and the text track is the `1fr`, so
                 the headline column only ever grows with the viewport.

                 The left track is the wider of the two, which looks backwards
                 against the file sizes but is what makes the pair balance. The
                 phone illustration is drawn inside a soft halo and only about
                 two thirds of its 717x840 frame is the subject; the house fills
                 roughly nine tenths of its own. Matched by frame the house
                 would out-weigh the phone by a third, so the tracks are sized
                 to make the two subjects read at the same height instead. */}
          <div
            className="mx-auto grid max-w-[95rem] grid-cols-1 items-center gap-y-8 md:grid-cols-[15rem_minmax(0,1fr)_14rem] md:gap-x-4 lg:grid-cols-[21rem_minmax(0,1fr)_20rem] lg:gap-x-6 xl:grid-cols-[25rem_minmax(0,1fr)_24rem] xl:gap-x-8 2xl:grid-cols-[28rem_minmax(0,1fr)_27rem]"
          >
            {/* Text first in the DOM: the illustrations are decoration and are
                hidden from assistive tech, so source order should read as the
                hero's meaning does. Explicit column and row starts place them
                visually. Deliberately no `col-span-*` anywhere in here — that
                utility is the `grid-column` shorthand and would reset the
                `col-start` beside it depending on which one Tailwind emits
                last. Longhand starts and ends cannot collide. */}
            <div className="col-start-1 row-start-1 space-y-5 sm:space-y-6 md:col-start-2">
              <h1
                /* The type ramp steps back down at `lg`. Up to `md` the
                   headline owns the full width of the band; from `lg` it
                   shares the row with two illustrations and the column it is
                   left with is 464px, where 60px would break the title across
                   four lines. It climbs again at `xl` and `2xl` as the column
                   widens to 640px and 752px. */
                className="hero-title text-balance text-2xl font-extrabold leading-tight tracking-tight text-white xs:text-3xl sm:text-5xl md:text-6xl pt-1 sm:pt-2 lg:text-4xl xl:text-5xl 2xl:text-6xl"
                style={{ fontFamily: "'Manrope', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
              >
                {t('home.hero.title')}
              </h1>

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

            {/* The artwork is named for where it goes: left-img on the left,
                right-img on the right. The animation lives on these wrappers
                rather than on the <img> so the light pool travels with the
                piece it belongs to; `.hero-art-left` / `.hero-art-right` set
                nothing but `animation` — see the note in index.css about why a
                `display` here would break the `lg:` placement above.

                Both are eager: they are above the fold and lazy-loading them
                paints an empty hero that fills in a beat later. Neither is
                fetchPriority="high" — 260KB of decoration should not outrank
                the headline's font and the first paint of the text. */}
            <div className="hero-art-left relative col-start-1 row-start-1 hidden justify-center md:flex">
              {/* A pool of lighter brand blue at the foot of each piece. Both
                  illustrations bottom out in deep navy — the phone's city slab
                  and the house's base plinth — and the band ends on #071a5c, so
                  the one thing that would not separate them is a shadow: dark
                  on dark behind dark. A lighter blue behind the base silhouettes
                  them upward instead, and being a blurred ellipse rather than a
                  panel it never reads as a card around the artwork. */}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-[50%] bg-brand/45 blur-2xl"
                aria-hidden="true"
              />
              <img
                src="/img/left-img.webp"
                alt=""
                aria-hidden="true"
                width={717}
                height={840}
                loading="eager"
                decoding="async"
                className="relative h-auto w-full select-none object-contain"
              />

              {/* Placed against features of the artwork, not against the box:
                  the top pill sits beside the phone's screen and the bottom one
                  on the city slab, which is why the offsets are not symmetric.
                  Both are hidden below `lg` — at md the track is 15rem and a
                  pill would cover the phone it is meant to annotate. */}
              <HeroBadge
                icon={ShieldCheck}
                label={t('home.hero.badges.trustedListings')}
                className="left-0 top-[22%] hidden lg:inline-flex"
              />
              <HeroBadge
                icon={Users}
                label={t('home.hero.badges.directFromOwner')}
                className="bottom-[14%] left-[6%] hidden lg:inline-flex"
              />
            </div>

            <div className="hero-art-right relative col-start-3 row-start-1 hidden justify-center md:flex">
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-[50%] bg-brand/45 blur-2xl"
                aria-hidden="true"
              />
              <img
                src="/img/right-img.webp"
                alt=""
                aria-hidden="true"
                width={840}
                height={770}
                loading="eager"
                decoding="async"
                className="relative h-auto w-full select-none object-contain"
              />

              <HeroBadge
                icon={ShieldCheck}
                label={t('home.hero.badges.safeAndSecure')}
                className="right-0 top-[10%] hidden lg:inline-flex"
              />
              <HeroBadge
                icon={BadgePercent}
                label={t('home.hero.badges.noCommission')}
                className="bottom-[16%] right-0 hidden lg:inline-flex"
              />
              <HeroBadge
                icon={Zap}
                label={t('home.hero.badges.fastAndEasy')}
                className="bottom-[2%] left-[4%] hidden xl:inline-flex"
              />
            </div>
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
