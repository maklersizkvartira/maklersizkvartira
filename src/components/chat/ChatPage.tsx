/**
 * Messages screen.
 *
 * There is no messaging backend. The previous version kept conversations in
 * a zustand slice, so every "sent" message lived in one browser tab and was
 * never delivered to the other person — the inbox looked functional and was
 * not. Rather than reproduce that, this screen states the situation and
 * routes the user to the contact channels that do work (phone, Telegram),
 * while keeping the composer as a local draft pad they can copy from.
 */

import React, { useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Info,
  MessageSquare,
  PhoneCall,
  PlusCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../ui/Field';
import { canPublishListings } from '../../types/roles';

const QUICK_QUESTION_KEYS = [
  'chat.composer.quick.viewing',
  'chat.composer.quick.address',
  'chat.composer.quick.contract',
  'chat.composer.quick.phone',
] as const;

const CONTACT_STEPS = [
  { icon: Building2, titleKey: 'chat.contact.step1Title', bodyKey: 'chat.contact.step1Body' },
  { icon: PhoneCall, titleKey: 'chat.contact.step2Title', bodyKey: 'chat.contact.step2Body' },
  { icon: ExternalLink, titleKey: 'chat.contact.step3Title', bodyKey: 'chat.contact.step3Body' },
] as const;

export const ChatPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const pushToast = useAppStore((state) => state.pushToast);

  // Draft state is deliberately component-local: nothing here is persisted or
  // transmitted, and pretending otherwise in the store is what caused the
  // phantom inbox in the first place.
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const appendQuestion = (text: string) => {
    setCopied(false);
    setDraft((current) => (current.trim() ? `${current.trimEnd()}\n${text}` : text));
  };

  const handleCopy = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
      pushToast('common.action.copied', 'success');
    } catch {
      pushToast('common.error.generic', 'error');
    }
  };

  const handleCreateListing = () => {
    if (!currentUser) {
      setShowAuth(true, 'REGISTER');
      return;
    }
    if (!canPublishListings(currentUser.role)) {
      pushToast('chat.toast.ownerOnly', 'warning');
      return;
    }
    setCurrentView('CREATE_LISTING');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-content sm:text-2xl">{t('layout.nav.chat')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('chat.page.subtitle')}</p>
        </div>
      </header>

      {/* The honest status of the feature, announced rather than buried. */}
      <section
        role="status"
        className="mt-5 rounded-2xl border border-info/30 bg-info-soft p-4 sm:p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-black text-info">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('chat.notice.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-content">{t('chat.notice.body')}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{t('chat.notice.legacyNote')}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => setCurrentView('LISTINGS')}
            className="px-4 py-2.5 text-xs"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {t('chat.actions.browse')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCreateListing}
            className="px-4 py-2.5 text-xs"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t('chat.actions.create')}
          </Button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-black text-content">{t('chat.contact.title')}</h2>
        <ol className="mt-3 space-y-3">
          {CONTACT_STEPS.map(({ icon: Icon, titleKey, bodyKey }, index) => (
            <li key={titleKey} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-content">
                  {formatNumber(index + 1)}. {t(titleKey)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{t(bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5 flex gap-2.5 rounded-2xl border border-brand/30 bg-brand-soft p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-black text-brand-text">{t('chat.safety.title')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-content">{t('chat.safety.body')}</p>
        </div>
      </section>

      {/* The composer survives as a draft pad: typing and the quick questions
          still work, only delivery does not — so the button is disabled and
          says why, instead of quietly vanishing. */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="text-sm font-black text-content">{t('chat.composer.title')}</h2>

        <p className="mt-3 text-xs font-bold text-muted">{t('chat.composer.quickTitle')}</p>
        <p className="mt-0.5 text-xs text-subtle">{t('chat.composer.quickHint')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_QUESTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => appendQuestion(t(key))}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-bold text-muted transition-colors hover:bg-brand-soft hover:text-brand-text"
            >
              {t(key)}
            </button>
          ))}
        </div>

        {/* The section heading is the visible label; this one names the field
            for assistive tech without repeating the text on screen. */}
        <label htmlFor="chat-draft" className="sr-only">
          {t('chat.composer.title')}
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setCopied(false);
          }}
          rows={4}
          placeholder={t('chat.composer.placeholder')}
          aria-describedby="chat-draft-hint"
          className="mt-4 w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none"
        />

        <p id="chat-draft-hint" className="mt-2 text-xs leading-relaxed text-warning">
          {t('chat.composer.disabledHint')}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleCopy()}
            disabled={!draft.trim()}
            className="px-4 py-2.5 text-xs"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? t('common.action.copied') : t('common.action.copy')}
          </Button>

          <Button
            type="button"
            disabled
            aria-describedby="chat-draft-hint"
            title={t('chat.composer.disabledHint')}
            className="px-4 py-2.5 text-xs"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {t('common.action.send')}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;
