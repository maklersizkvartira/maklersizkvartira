/** Site footer. */

import React from 'react';
import { Mail, Phone, Send, ShieldCheck } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore, type ViewState } from '../../stores/useAppStore';
import { Logo } from '../brand/Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

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

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const columns: Array<{ titleKey: string; links: Array<{ labelKey: string; view?: ViewState }> }> = [
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
        { labelKey: 'layout.footer.terms' },
        { labelKey: 'layout.footer.privacy' },
        { labelKey: 'layout.footer.safety' },
        { labelKey: 'layout.footer.faq' },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Logo size="md" tagline={t('common.brand.shortTagline')} />
            <p className="text-xs leading-relaxed text-muted">
              {t('layout.footer.aboutText')}
            </p>

            <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="text-[11px] font-black uppercase tracking-wide text-content">
                {t('layout.footer.support')}
              </p>
              <div className="flex flex-col gap-1.5 text-xs font-semibold text-muted">
                <a
                  href="tel:+998700797237"
                  className="inline-flex items-center gap-2 transition-colors hover:text-brand-text"
                >
                  <Phone className="h-3.5 w-3.5 text-brand shrink-0" aria-hidden="true" />
                  <span>+998 70 079 72 37</span>
                </a>
                <a
                  href="tel:+998777850737"
                  className="inline-flex items-center gap-2 transition-colors hover:text-brand-text"
                >
                  <Phone className="h-3.5 w-3.5 text-brand shrink-0" aria-hidden="true" />
                  <span>+998 77 785 07 37</span>
                </a>
              </div>
            </div>

            <p className="inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[11px] font-black text-brand-text">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('common.badge.noCommission')}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.titleKey} aria-label={t(column.titleKey as never)}>
              <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-content">
                {t(column.titleKey as never)}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.labelKey}>
                    <button
                      type="button"
                      onClick={() => link.view && setCurrentView(link.view)}
                      className="text-xs text-muted transition-colors hover:text-brand-text"
                    >
                      {t(link.labelKey as never)}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <p className="text-[11px] text-subtle">
            {t('layout.footer.rights', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-2.5">
            <a
              href="https://www.instagram.com/maklersizuy.uz/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-brand hover:text-brand-text"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href="https://t.me/maklersizuy"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Telegram"
              className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-brand hover:text-brand-text"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="mailto:support@maklersizuy.uz"
              aria-label={t('layout.footer.contact')}
              className="rounded-lg border border-line p-2 text-muted transition-colors hover:border-brand hover:text-brand-text"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
            </a>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
