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
  telegramUsername: string;
  telegramLabel: string;
}

const SUPPORT_CONTACTS: SupportContact[] = [
  {
    dial: '+998937188885',
    label: '+998 93 718 88 85',
    telegramUsername: 'LOGO_55',
    telegramLabel: '@LOGO_55',
  },
  {
    dial: '+998777850737',
    label: '+998 77 785 07 37',
    telegramUsername: 'karimov_developer',
    telegramLabel: '@karimov_developer',
  },
];

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

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
            {/* Maklersiz uy va kvartira ijarasi matni olib tashlandi */}

            {/*
              The helpline, written as a column like the ones beside it: a
              heading, then one thing to press.

              The `tel:` href is not optional. index.html carries
              `format-detection: telephone=no`, which is what stops iOS from
              turning every price and area figure on the site into a phone
              link — and it stops this number from linkifying too. Without an
              explicit anchor the support line is text a visitor has to copy
              by hand.
            */}
            <div>
              <h2 className="mb-1 text-xs font-black uppercase tracking-wide text-content">
                {t('layout.footer.supportBlock.title')}
              </h2>
              <p className="mb-3 text-[11px] font-bold text-brand-text">
                {t('layout.footer.supportBlock.feedback' as never) || 'Taklif va shikoyatlar uchun:'}
              </p>
              <ul className="flex flex-col gap-2.5">
                {SUPPORT_CONTACTS.map((contact) => (
                  <li key={contact.dial} className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${contact.dial}`}
                      aria-label={t('layout.footer.supportBlock.phoneAria', {
                        phone: contact.label,
                      })}
                      className="press inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-1.5 text-xs sm:text-sm font-black text-content transition-colors hover:border-brand/40 hover:text-brand-text"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {contact.label}
                    </a>
                    <a
                      href={`https://t.me/${contact.telegramUsername}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Telegram: ${contact.telegramLabel}`}
                      className="press inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#229ED9]/30 bg-[#229ED9]/10 px-2.5 py-1.5 text-xs font-bold text-[#229ED9] transition-colors hover:bg-[#229ED9]/20"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{contact.telegramLabel}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-subtle">
                {t('layout.footer.supportBlock.hours')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {columns.map((column) => (
              <nav
                key={column.titleKey}
                aria-label={t(column.titleKey as never)}
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

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="hidden sm:block text-[11px] text-subtle">
            {t('layout.footer.rights', { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/maklersizuy.uz/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Instagram"
                className="press group flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:text-white hover:shadow-md hover:shadow-pink-500/25 active:scale-95"
              >
                <InstagramIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
              </a>
              <a
                href="https://t.me/maklersizuy"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Telegram"
                className="press group flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-[#229ED9] hover:text-white hover:shadow-md hover:shadow-sky-500/25 active:scale-95"
              >
                <Send className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
              </a>
              <a
                href="mailto:support@maklersizuy.uz"
                className="press group flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-brand hover:text-white hover:shadow-md hover:shadow-brand/25 active:scale-95"
              >
                <Mail className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
              </a>
            </div>

            <div className="h-4 w-px bg-line" aria-hidden="true" />

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
