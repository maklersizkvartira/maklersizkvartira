/**
 * Referral programme.
 *
 * The XP/referral counters that used to drive this page were client-side
 * fiction: an `addXp` call in the store and a hardcoded leaderboard. Only two
 * numbers have a real source now — `currentUser.referralCode` and
 * `currentUser.xpPoints` — so everything else is presented as programme
 * information rather than as the user's own progress, and the leaderboard
 * states plainly that it is not wired up instead of inventing names.
 */

import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Copy,
  Crown,
  Gift,
  Rocket,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';

/** Milestone copy only — there is no server-side referral count to match against. */
const REWARDS = [
  { id: 'xp', friends: 1, icon: Zap },
  { id: 'badge', friends: 3, icon: Award },
  { id: 'premium', friends: 5, icon: Sparkles },
  { id: 'boost', friends: 10, icon: Rocket },
  { id: 'vip', friends: 25, icon: Crown },
  { id: 'ambassador', friends: 50, icon: Share2 },
] as const;

export const ReferralPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const pushToast = useAppStore((state) => state.pushToast);

  const [copied, setCopied] = useState(false);

  const referralCode = currentUser?.referralCode ?? null;
  const referralLink = referralCode
    ? `https://maklersizuy.uz/r/${encodeURIComponent(referralCode)}`
    : null;

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      pushToast('growth.code.copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is blocked in insecure contexts and some in-app browsers.
      pushToast('growth.code.copyFailed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* -------------------------------------------------------------- */}
        {/* Hero                                                            */}
        {/* -------------------------------------------------------------- */}
        <section className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-10 md:flex-row">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, var(--color-brand) 0, transparent 45%), radial-gradient(circle at 85% 10%, var(--color-warning) 0, transparent 40%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-3 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1 text-[11px] font-black uppercase tracking-wide text-brand-text">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t('growth.hero.eyebrow')}
            </span>
            <h1 className="text-3xl font-black tracking-tight text-content sm:text-4xl">
              {t('growth.hero.title')}
            </h1>
            <p className="max-w-lg text-xs leading-relaxed text-muted sm:text-sm">
              {t('growth.hero.subtitle')}
            </p>
          </div>

          {/* Referral code card */}
          <div className="relative z-10 w-full shrink-0 space-y-3 rounded-2xl border border-line bg-surface-2 p-5 text-center md:w-80">
            {referralLink && referralCode ? (
              <>
                <span className="block text-xs font-bold uppercase tracking-wider text-subtle">
                  {t('growth.code.label')}
                </span>
                <p
                  className="rounded-xl border border-line-2 bg-surface py-2 font-mono text-2xl font-black tracking-widest text-brand-text"
                  aria-label={t('growth.code.label')}
                >
                  {referralCode}
                </p>
                <p className="truncate text-[11px] text-subtle" title={referralLink}>
                  {referralLink}
                </p>
                <Button fullWidth onClick={() => void handleCopy()} className="py-2.5 text-xs">
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? t('growth.code.copied') : t('growth.code.copyLink')}
                </Button>
              </>
            ) : currentUser ? (
              <>
                <h2 className="text-sm font-black text-content">{t('growth.code.missingTitle')}</h2>
                <p className="text-xs text-muted">{t('growth.code.missingBody')}</p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-black text-content">{t('growth.code.guestTitle')}</h2>
                <p className="text-xs text-muted">{t('growth.code.guestBody')}</p>
                <Button fullWidth onClick={() => setShowAuth(true, 'REGISTER')} className="py-2.5 text-xs">
                  {t('growth.code.guestCta')}
                </Button>
              </>
            )}
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Real progress: XP is the only server-backed number here.        */}
        {/* -------------------------------------------------------------- */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
              <Zap className="h-4 w-4 text-warning" aria-hidden="true" />
              {t('growth.xp.label')}
            </h2>
            <p className="mt-1.5 text-2xl font-black text-content">
              {currentUser
                ? t('growth.xp.value', { count: formatNumber(currentUser.xpPoints) })
                : t('common.state.empty')}
            </p>
            <p className="mt-1 text-xs text-muted">{t('growth.xp.hint')}</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-subtle">
              <Users className="h-4 w-4 text-info" aria-hidden="true" />
              {t('growth.progress.title')}
            </h2>
            <p className="mt-1.5 text-xs text-muted">{t('growth.progress.unavailable')}</p>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Reward milestones                                               */}
        {/* -------------------------------------------------------------- */}
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-content">
              <Gift className="h-5 w-5 text-brand" aria-hidden="true" />
              {t('growth.rewards.title')}
            </h2>
            <p className="text-xs text-muted">{t('growth.rewards.subtitle')}</p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {REWARDS.map((reward) => (
              <li
                key={reward.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-raised"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-text">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {t('growth.rewards.friends', { count: formatNumber(reward.friends) })}
                  </span>
                  <reward.icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-content">
                    {t(`growth.rewards.${reward.id}Title`)}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {t(`growth.rewards.${reward.id}Desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Leaderboard — kept as a placeholder until the API exists.       */}
        {/* -------------------------------------------------------------- */}
        <section className="space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-card">
          <h2 className="flex items-center gap-2 border-b border-line pb-3 text-lg font-black text-content">
            <Trophy className="h-5 w-5 text-warning" aria-hidden="true" />
            {t('growth.leaderboard.title')}
          </h2>

          <div className="rounded-2xl border border-dashed border-line-2 bg-surface-2 p-8 text-center">
            <h3 className="text-sm font-bold text-content">
              {t('growth.leaderboard.unavailableTitle')}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-muted">
              {t('growth.leaderboard.unavailableBody')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ReferralPage;
