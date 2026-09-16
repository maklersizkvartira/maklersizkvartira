/**
 * The wallet as a page of its own, at /wallet.
 *
 * On a phone the wallet used to open as a bottom sheet over the profile —
 * a 650px scroll box with a grab handle, inside which the balance, the
 * top-up button, the badge and the ledger all had to fit. A sheet is for a
 * decision that takes a moment; a wallet is a place people go back to, so
 * it has an address, a back button and the browser's own history.
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { WalletCard } from './WalletCard';

export const WalletPage: React.FC = () => {
  const { t } = useTranslation();
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const currentUser = useAppStore((state) => state.currentUser);

  if (!currentUser) return null;

  return (
    <div className="gutter-safe mx-auto w-full max-w-2xl py-4 pb-28 sm:py-8 lg:pb-12">
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentView('PROFILE')}
          aria-label={t('common.action.back')}
          className="press -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-content sm:text-2xl">{t('account.wallet.title')}</h1>
          <p className="text-sm text-muted">{t('account.wallet.subtitle')}</p>
        </div>
      </header>
      <WalletCard embedded />
    </div>
  );
};

export default WalletPage;
