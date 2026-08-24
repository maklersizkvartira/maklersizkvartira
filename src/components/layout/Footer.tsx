/** Site footer. */

import React from 'react';
import { Mail, MapPin, Send, ShieldCheck } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore, type ViewState } from '../../stores/useAppStore';
import { Logo } from '../brand/Logo';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';

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
          <div>
            <Logo size="md" tagline={t('common.brand.shortTagline')} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t('layout.footer.aboutText')}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[11px] font-black text-brand-text">
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
          <div className="flex items-center gap-3">
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
