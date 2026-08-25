/** Site footer. */

import React from 'react';
import { Mail, Phone, Send } from 'lucide-react';

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
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-4">
          <div className="space-y-4">
            <Logo size="md" tagline={t('common.brand.shortTagline')} />
            <p className="text-xs leading-relaxed text-muted">
              {t('layout.footer.aboutText')}
            </p>

            <div className="space-y-2 rounded-2xl border border-line bg-surface-2/60 p-3.5 backdrop-blur-xs transition-colors hover:border-brand/40">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                  <Phone className="h-3 w-3" aria-hidden="true" />
                </span>
                <p className="text-[11px] font-black uppercase tracking-wider text-content">
                  {t('layout.footer.support')}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pt-1 text-xs font-semibold text-muted">
                <a
                  href="tel:+998700797237"
                  className="group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface hover:text-brand-text"
                >
                  <span className="font-semibold text-content">+998 70 079 72 37</span>
                  <span className="text-[10px] font-bold text-brand group-hover:underline">Qo‘ng‘iroq</span>
                </a>
                <a
                  href="tel:+998777850737"
                  className="group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface hover:text-brand-text"
                >
                  <span className="font-semibold text-content">+998 77 785 07 37</span>
                  <span className="text-[10px] font-bold text-brand group-hover:underline">Qo‘ng‘iroq</span>
                </a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {columns.map((column) => (
              <nav
                key={column.titleKey}
                aria-label={t(column.titleKey as never)}
                className={column.titleKey === 'layout.footer.legal' ? 'hidden sm:block' : ''}
              >
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-content">
                  {t(column.titleKey as never)}
                </h2>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.labelKey}>
                      <button
                        type="button"
                        onClick={() => link.view && setCurrentView(link.view)}
                        className="cursor-pointer text-xs text-muted transition-colors hover:text-brand-text"
                      >
                        {t(link.labelKey as never)}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <p className="text-[11px] text-subtle">
            {t('layout.footer.rights', { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:pr-48">
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/maklersizuy.uz/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Instagram"
                className="group flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:text-white hover:shadow-md hover:shadow-pink-500/25 active:scale-95"
              >
                <InstagramIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
              </a>
              <a
                href="https://t.me/maklersizuy"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Telegram"
                className="group flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-[#229ED9] hover:text-white hover:shadow-md hover:shadow-sky-500/25 active:scale-95"
              >
                <Send className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
              </a>
              <a
                href="mailto:support@maklersizuy.uz"
                aria-label={t('layout.footer.contact')}
                className="group flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2/80 text-muted transition-all duration-200 hover:scale-105 hover:border-transparent hover:bg-brand hover:text-white hover:shadow-md hover:shadow-brand/25 active:scale-95"
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
