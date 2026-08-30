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
import { BadgeCheck, Search, ShieldCheck, Users, Wallet, Zap } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { SearchModal } from './SearchModal';
import { QuickCategories } from './QuickCategories';

/**
 * A label laid on one of the hero illustrations.
 *
 * The previous version trailed a hairline leader out to a ringed dot, the idea
 * being that a label should point at the feature it names. It never did. The
 * leader's reach is a fixed pixel offset and the artwork behind it is a raster
 * image that rescales with its grid track — 336px wide at `lg`, 448px at
 * `2xl` — so the dot came to rest in empty blue beside the picture rather than
 * on anything in it, which is exactly what the owner objected to. No fixed
 * offset lands on a feature at every width, so the leader is gone and the
 * pills moved onto the art: overlapping the phone, overlapping the house.
 * Sitting on the picture is what makes a label belong to it, and it needs
 * nothing lined up to work.
 *
 * The placement percentages are load-bearing. The wrapper's box IS the image's
 * box — the <img> is its only in-flow child and is `w-full h-auto` — so a
 * percentage offset names the same point of the drawing at 1024px as at
 * 1920px, which is the guarantee a pixel offset could not give.
 *
 * They are also MEASURED rather than eyeballed, and that is the second half of
 * the lesson the leader taught. Both illustrations are isometric — a diamond
 * of drawing inside a rectangular frame — so each of the four corners of the
 * frame is transparent, and "near the edge" reads as on the picture along the
 * middle of a side and as floating in the band at a corner. The first pass at
 * this put pills at `bottom-[19%] left-[5%]` and `bottom-[1%] left-[12%]`,
 * which are the two lower corners: alpha coverage 11% and 10%, which is to
 * say they were the leader's empty blue again with the line taken off. Every
 * offset below sits over at least three quarters of solid artwork at `lg`,
 * `xl` and `2xl` alike — the pill's own width is 36-39% of the drawing and
 * changes with the breakpoint, so a spot that works at one has to be checked
 * at all three.
 *
 * The plate, the icon tile and the hover live in index.css; the note there
 * explains why the fill is frosted glass rather than a flat tint. Idle, each
 * pill drifts on a slow loop whose phase is offset by a negative delay per
 * index, so no two of them breathe together.
 *
 * `display` is set here and only here (`hidden lg:inline-flex`): below `lg`
 * the illustrations are a short band under the headline and there is no room
 * on them for a label that would not cover what it names.
 */
const HeroBadge: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Offsets the idle drift so the pills do not breathe in unison. */
  index?: number;
  /** Where it sits on the artwork, in percentages of the image's own box. */
  className?: string;
}> = ({ icon: Icon, label, index = 0, className = '' }) => (
  <span
    aria-hidden="true"
    className={`hero-badge pointer-events-auto absolute z-20 hidden lg:inline-flex ${className}`}
    style={{ animationDelay: `${index * -900}ms` }}
  >
    <span className="hero-badge-pill inline-flex items-center gap-1.5 rounded-2xl py-1.5 pl-1.5 pr-2.5 xl:gap-2 xl:py-2 xl:pl-2 xl:pr-3">
      <span className="hero-badge-icon grid h-6 w-6 shrink-0 place-items-center rounded-[0.625rem] text-white xl:h-7 xl:w-7 xl:rounded-xl">
        <Icon className="h-3 w-3 xl:h-3.5 xl:w-3.5" />
      </span>
      {/* The width cap is what shapes the pill. Left to run on one line these
          labels are 100-140px of text beside a 24px tile, which is half the
          width of the drawing they sit on; held to this they wrap to two or
          three short lines and the pill stays about a third of the artwork,
          the proportion the owner's own reference uses. */}
      <span className="hero-badge-label max-w-[4.75rem] text-left text-[10px] font-extrabold leading-[1.25] tracking-tight text-white xl:max-w-[5.75rem] xl:text-[11px] 2xl:max-w-[7rem]">
        {label}
      </span>
    </span>
  </span>
);

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const [showSearchModal, setShowSearchModal] = useState(false);

  return (
    <div className="w-full">
      <section className="gutter-safe relative overflow-hidden bg-gradient-to-b from-band to-band-2 pb-10 pt-5 text-center text-on-band sm:pb-14 sm:pt-8 lg:pb-16">
        <div className="relative z-10 flex flex-col gap-6 sm:gap-7">
          {/* The category rail.

              On a phone it stays where it was, directly under the bar: it is
              the fastest route into the catalogue and burying it under a
              headline, a search pill and nothing else would cost a scroll.

              From `lg` it moves BELOW the headline and the search, which is
              also where the artwork lives — so the eye reads the promise, then
              the search, then the ten ways in, instead of meeting a strip of
              small tiles before it knows what the site is. Done with flex
              `order` rather than a second copy of the component: two instances
              would mean two scroll containers and two sets of ten images.

              It also gets a wider column down there. Up top it was held to
              `5xl` so widening the artwork stage would not stretch it; below
              the grid it has the full width to use, which is what lets the
              bigger cards sit in one row instead of scrolling. */}
          <div className="order-first mx-auto w-full max-w-5xl lg:order-last lg:max-w-7xl">
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

              {/* `hero-search-in` goes on this wrapper, not on the button: the
                  button's own `transition-all` answers hover and press, and an
                  entrance transform on the same element would be overwritten
                  the moment a pointer touched it mid-animation. */}
              <div className="hero-search-in mx-auto max-w-3xl px-1">
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

              {/* Three, not four, and the artwork chose the number.

                  The phone owns the middle band of this piece from 17% to 65%
                  of its height, and its screen is carrying a listing card with
                  a title and a price on it — a pill parked there covers the
                  one thing in the illustration that is actually readable. So
                  the three go on the isometric city instead, and the city is a
                  diamond: it reaches the frame's left edge only around 60% of
                  the way down, and its two lower corners are empty.

                  One on the left flank over the tall tower and the road that
                  runs past it (85% solid), one on the slab under the phone's
                  foot (77%), one on the block of towers at the right (75%).
                  The lower-LEFT corner, where the second of these used to sit,
                  is 11% solid — it is off the drawing, which is what the pills
                  were moved onto the artwork to stop.

                  The fourth label promised an automatic AI screening the
                  platform no longer runs, and it was the longest string of the
                  eight besides; it is gone rather than parked back out in the
                  margin. */}
              <HeroBadge
                icon={ShieldCheck}
                label={t('home.hero.badges.trustedListings')}
                index={0}
                className="left-[2%] top-[46%]"
              />
              <HeroBadge
                icon={Users}
                label={t('home.hero.badges.directFromOwner')}
                index={1}
                className="bottom-[25%] left-[21%]"
              />
              <HeroBadge
                icon={BadgeCheck}
                label={t('home.hero.badges.passportChecked')}
                index={2}
                className="bottom-[25%] right-[1%]"
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

              {/* Three again, and this time the shield is what sets the
                  count. The cutaway house is furnished room by room and the
                  glowing shield is pinned over its left flank from 33% to 78%
                  of the height; that shield IS the trust claim, so covering it
                  with a pill that says "Xavfsiz va ishonchli" would be the
                  label eating its own subject.

                  Which leaves the house itself, and all three go on it: the
                  roof and the top of the upper floor (89% solid), the upper
                  floor's right rooms beside the shield (97%), and the ground
                  floor's terrace on the plinth (88%).

                  Not the bottom-left corner, which is where the third of these
                  was: below the shield the plinth has already cut away to its
                  left point, and the best any pill can do down there is 51%
                  solid — the one it was actually at managed 10%. Nor the top
                  right, where the first was: the roof is a peak, so at 10% of
                  the height the drawing is 20% of the frame wide and a pill
                  pinned to the right edge hangs off into the band (36%).

                  The dropped fourth, "24/7 qo‘llab-quvvatlash", is a promise
                  about the company rather than about the home in the picture,
                  and there is no fourth clear face to put it on. */}
              <HeroBadge
                icon={Zap}
                label={t('home.hero.badges.fastAndEasy')}
                index={3}
                className="left-[32%] top-[9%]"
              />
              <HeroBadge
                icon={ShieldCheck}
                label={t('home.hero.badges.safeAndSecure')}
                index={4}
                className="right-[15%] top-[36%]"
              />
              <HeroBadge
                icon={Wallet}
                label={t('home.hero.badges.freeToPost')}
                index={5}
                className="bottom-[20%] right-[15%]"
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
