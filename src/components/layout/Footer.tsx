/** Site footer. */

import React from 'react';
import { Mail, Phone, Send } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { type ViewState } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';
import { BLOG_PATH, HELP_PATH, helpPath, viewPath } from '../../seo/routes';
import { Logo } from '../brand/Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

/**
 * The helpline numbers, in the order they should be tried.
 *
 * Kept here rather than in the locale files because a phone number is not
 * translated copy: holding it as a string in uz/ru/en meant changing the
 * helpline required editing three translation files in lockstep, and the
 * aria-label repeated the digits a fourth time. The label is the human
 * spacing, `dial` is what `tel:` needs.
 */
interface SupportContact {
  dial: string;
  label: string;
}

const SUPPORT_CONTACTS: SupportContact[] = [
  { dial: '+998937188885', label: '+998 93 718 88 85' },
  { dial: '+998777850737', label: '+998 77 785 07 37' },
];

/**
 * The Instagram mark.
 *
 * It lives here because lucide dropped its brand glyphs, not because anybody
 * wanted to draw one: this is lucide's own instagram geometry — the same 24
 * grid, the same round caps and joins — so that the three icons in the
 * contact tray are one typeface rather than a hand-drawn shape standing next
 * to two library ones. `strokeWidth` is a prop for the same reason: the tray
 * sets one weight and all three glyphs take it.
 */
const InstagramIcon: React.FC<{ className?: string; strokeWidth?: number }> = ({
  className,
  strokeWidth = 2,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

/**
 * The contact tray: Instagram, Telegram, and the support mailbox.
 *
 * Three things about this shape are deliberate.
 *
 * The accent is a single colour per channel, held as a CSS variable on the
 * link and read by the tint and the glyph. It replaced a three-stop
 * orange-pink-purple gradient that was the loudest object in the footer and
 * the only reason the buttons were interesting at all; a quiet chip that
 * takes on the channel's colour says the same thing without shouting. The
 * mailbox points its variables at the brand tokens rather than a hex pair, so
 * it re-themes with everything else.
 *
 * `label` is the accessible name. The two networks are proper nouns and are
 * not translated; the mailbox is named by its own address, on the same
 * reasoning as SUPPORT_CONTACTS above — an address is not translated copy,
 * and hearing it is more use than hearing the word "mail". It previously had
 * no name at all: the icon was `aria-hidden` and nothing replaced it, so a
 * screen reader announced the third link as its bare href.
 */
interface ContactLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: string;
  accentSoft: string;
  /** Off-site destinations open in a new tab; `mailto:` must not. */
  external?: boolean;
}

const SUPPORT_EMAIL = 'support@uyiz.uz';

const CONTACT_LINKS: ContactLink[] = [
  {
    href: 'https://www.instagram.com/uyiz.uz/',
    label: 'Instagram',
    icon: InstagramIcon,
    // Instagram's magenta, darkened just enough to stay legible on white and
    // still read on the dark surface — one colour has to serve both themes.
    accent: '#d6336c',
    accentSoft: 'rgb(214 51 108 / 0.14)',
    external: true,
  },
  {
    href: 'https://t.me/uyiz',
    label: 'Telegram',
    icon: Send,
    accent: '#1c8fcb',
    accentSoft: 'rgb(34 158 217 / 0.16)',
    external: true,
  },
  {
    href: `mailto:${SUPPORT_EMAIL}`,
    label: SUPPORT_EMAIL,
    icon: Mail,
    accent: 'var(--color-brand)',
    accentSoft: 'var(--color-brand-soft)',
  },
];

interface FooterLink {
  labelKey: string;
  view?: ViewState;
  /** A content path, for destinations that are not app views. */
  to?: string;
}

export const Footer: React.FC = () => {
  const { t } = useTranslation();

  const columns: Array<{ titleKey: string; links: FooterLink[] }> = [
    {
      titleKey: 'layout.footer.forTenants',
      links: [
        { labelKey: 'layout.nav.listings', view: 'LISTINGS' },
        { labelKey: 'layout.nav.map', view: 'MAP' },
        { labelKey: 'layout.nav.favorites', view: 'FAVORITES' },
        { labelKey: 'layout.nav.studentProgram', view: 'STUDENT_PROGRAM' },
      ],
    },
    {
      titleKey: 'layout.footer.forOwners',
      links: [
        { labelKey: 'layout.nav.createListing', view: 'CREATE_LISTING' },
        { labelKey: 'layout.nav.myListings', view: 'MY_LISTINGS' },
        { labelKey: 'layout.nav.verification', view: 'VERIFICATION' },
        { labelKey: 'layout.nav.referral', view: 'REFERRAL' },
      ],
    },
    {
      titleKey: 'layout.footer.legal',
      links: [
        { labelKey: 'layout.footer.terms', to: helpPath('foydalanish-shartlari') },
        { labelKey: 'layout.footer.privacy', to: helpPath('maxfiylik-siyosati') },
        { labelKey: 'layout.footer.safety', to: helpPath('xavfsizlik') },
        // Ko'p beriladigan savollar (FAQ) olib tashlandi
        { labelKey: 'layout.footer.guides', to: BLOG_PATH },
        { labelKey: 'layout.nav.help', to: HELP_PATH },
        { labelKey: 'layout.nav.ecosystem', view: 'ECOSYSTEM_PREVIEW' },
      ],
    },
  ];

  return (
    // The trailing padding is the bottom nav's clearance, and it belongs
    // here: `main`'s `pb-20` stops at `main`, and the footer is its sibling,
    // so the last row — the copyright, the social buttons, the language and
    // theme switchers — sat underneath a fixed bar that covers it. The figure
    // is what the nav actually occupies (BottomNav.tsx): a 48px row, its
    // `pb-safe-plus` 12px and the 1px top border, plus the home indicator.
    // Padding the footer rather than the shell keeps the gap `bg-surface`, so
    // the nav's translucent blur still has the footer behind it.
    <footer className="mt-auto border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom,0px)+3.75rem)] lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-4">
          <div className="space-y-4">
            <Logo size="md" tagline={t('common.brand.shortTagline')} />

            {/*
              The helpline: one quiet card holding both numbers.

              It briefly grew a Telegram handle beside every number, which
              turned a two-line block into four competing chips in two brand
              colours and buried the thing a visitor came here for — the
              number. The support Telegram is still one press away in the
              social row at the bottom of the footer, where the one account
              belongs; here the card is numbers only.

              The `tel:` href is not optional. index.html carries
              `format-detection: telephone=no`, which is what stops iOS from
              turning every price and area figure on the site into a phone
              link — and it stops these numbers from linkifying too. Without
              an explicit anchor the support line is text a visitor has to
              copy by hand.
            */}
            <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5 transition-colors hover:border-brand/40">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-content">
                  {t('layout.footer.supportBlock.title')}
                </h2>
              </div>
              {/* The rows are the one thing in this card that gets pressed, so
                  they carry the 44px target the old card never had — the row
                  is the hit area, not the digits inside it. */}
              <ul className="mt-2.5">
                {SUPPORT_CONTACTS.map((contact) => (
                  <li key={contact.dial}>
                    <a
                      href={`tel:${contact.dial}`}
                      aria-label={t('layout.footer.supportBlock.phoneAria', {
                        phone: contact.label,
                      })}
                      className="press group flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-surface-2"
                    >
                      <span className="font-semibold text-content">{contact.label}</span>
                      <span className="shrink-0 text-[11px] font-bold text-brand-text group-hover:underline">
                        {t('layout.footer.supportBlock.call')}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 px-2 text-[11px] text-subtle">
                {t('layout.footer.supportBlock.hours')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {columns.map((column) => (
              <nav
                key={column.titleKey}
                aria-label={t(column.titleKey as never)}
                className={column.titleKey === 'layout.footer.legal' ? 'hidden sm:block' : undefined}
              >
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-content">
                  {t(column.titleKey as never)}
                </h2>
                {/* The rows are 44px tall rather than the height of their own
                    text: a footer link is the smallest thing on the page and
                    was the hardest thing on it to hit with a thumb. */}
                <ul className="space-y-0.5">
                  {column.links.map((link) => (
                    <li key={link.labelKey}>
                      <AppLink
                        to={link.to ?? (link.view ? viewPath(link.view) : '/')}
                        view={link.to ? undefined : link.view}
                        className="press inline-flex min-h-11 cursor-pointer items-center text-xs text-muted transition-colors hover:text-brand-text"
                      >
                        {t(link.labelKey as never)}
                      </AppLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/*
          The three `hubLinks` groups — categories, Tashkent districts and
          regions — used to sit here. They were removed at the user's request:
          a hundred and some links under every page made the footer longer
          than most of the pages it ended.

          Worth knowing for whoever reads this next: the home page's SEO
          section rendered the same groups and has been removed too, so the
          generated landing pages now have no internal links pointing at them
          from the shell. They are reachable through the sitemap, through
          `relatedLinks` on the landing pages themselves, and from nowhere
          else.
        */}

        <div className="mt-8 flex flex-col items-center gap-5 border-t border-line pt-6 sm:flex-row sm:justify-between sm:gap-4">
          {/*
            Shown on a phone too.

            This was `hidden sm:block`, so the narrowest screen — the one most
            people arrive on — ended with a row of icons and two switchers and
            nothing saying whose site it was. The line is short, it costs one
            row, and a footer whose last word is a theme toggle reads unfinished.

            It is ordered last on mobile and first on desktop: on a phone the
            controls are what a thumb is reaching for and the copyright is the
            full stop underneath them, while on a wide screen the eye starts at
            the left, which is where the sentence belongs.
          */}
          <p className="order-last text-center text-[11px] text-subtle sm:order-first sm:text-left">
            {t('layout.footer.rights', { year: new Date().getFullYear() })}
          </p>
          {/*
            Two groups, not five objects.

            The contact links, a hairline divider and the two switchers used
            to sit at one level with one gap between all of them, so the row
            read as five unrelated buttons. The links are now a tray of their
            own — a bordered surface holding three chips — which is a stronger
            boundary than a 1px rule ever was, so the divider is gone. What
            separates the tray from the switchers is space: 24px between the
            groups against 4-8px inside them.

            The wrap and the centred alignment are for 360px, where the tray
            (150px) and the two switchers (~115px) still share one line.
          */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <nav aria-label={t('layout.footer.contact')}>
              <ul className="flex items-center gap-1 rounded-2xl border border-line bg-surface-2/70 p-1">
                {CONTACT_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      {/*
                        One gesture, in two parts that move together: the tint
                        rises into the chip from below while the glyph rolls
                        up out of its window. That is why the icon is rendered
                        twice — the track is 36px of icon in an 18px window,
                        and hovering slides the second copy into the place the
                        first one left, which reads as a roll rather than as
                        two things scaling against each other. It answers
                        `focus-visible` as well as `hover`; the old buttons
                        gave a keyboard user nothing but the browser ring.

                        Every moving utility carries `motion-safe`, so under
                        `prefers-reduced-motion` no transform is emitted at
                        all. The tint still arrives — it is carried by opacity
                        on its own, which the global clamp merely makes
                        instant — so the states still change, they just hold
                        still. Reaching for `motion-reduce` overrides instead
                        would have been a specificity race with the
                        `group-hover` rules.

                        The timings live on these children rather than on the
                        anchor because `.press` is unlayered: its
                        `transition-property`/`duration` beat any Tailwind
                        `duration-*` on the same element and would quietly
                        cut this to the 120ms tap feedback.
                      */}
                      <a
                        href={link.href}
                        {...(link.external
                          ? { target: '_blank', rel: 'noreferrer noopener' }
                          : {})}
                        aria-label={link.label}
                        style={
                          {
                            '--accent': link.accent,
                            '--accent-soft': link.accentSoft,
                          } as React.CSSProperties
                        }
                        className="press group relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-surface text-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-[var(--accent-soft)] opacity-0 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:translate-y-full motion-safe:group-hover:translate-y-0 motion-safe:group-focus-visible:translate-y-0"
                        />
                        <span
                          aria-hidden="true"
                          className="relative z-10 flex h-[18px] w-[18px] flex-col overflow-hidden transition-colors duration-300 group-hover:text-[var(--accent)] group-focus-visible:text-[var(--accent)]"
                        >
                          <span className="flex shrink-0 flex-col transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-translate-y-[18px] motion-safe:group-focus-visible:-translate-y-[18px]">
                            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
