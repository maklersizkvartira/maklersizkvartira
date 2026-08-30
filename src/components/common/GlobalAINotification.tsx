/**
 * A banner for the owner's own listings that an administrator flagged.
 *
 * It used to fire on the publish-time AI verdict (`aiCheckStatus === 'WARNING'`
 * with the reason read out of `aiRiskReasons`). That scanner is gone: nothing
 * writes those fields any more, so the banner would have been permanently
 * invisible. It now watches the real signal that replaced it - a moderator
 * setting the listing to WARNING after confirming a report - and quotes the
 * moderation note they left, which is the owner's only explanation.
 *
 * It used to mount <EditListingModal /> app-wide so its "edit" button could
 * open it through a store field. That coupling is gone: the banner now just
 * routes the owner to their listings, where editing lives.
 */

import React, { useState } from 'react';
import { AlertTriangle, Edit2, Trash2 } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { Button } from '../ui/Field';

export const GlobalAINotification: React.FC = () => {
  const { t } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const listings = useAppStore((state) => state.listings);
  const myListings = useAppStore((state) => state.myListings);
  const removeListing = useAppStore((state) => state.removeListing);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // `myListings` is the authoritative set, but a flagged listing can also be
  // sitting in the browse results, so both sources are merged and de-duplicated.
  const flagged = React.useMemo(() => {
    if (!currentUser) return [] as Listing[];
    const byId = new Map<string, Listing>();
    for (const listing of [...myListings, ...listings]) {
      if (listing.owner?.id !== currentUser.id) continue;
      // `status` is the live field. `aiCheckStatus` is only read as the legacy
      // alias an older container still sends, never as an AI verdict.
      if ((listing.status ?? listing.aiCheckStatus) !== 'WARNING') continue;
      byId.set(listing.id, listing);
    }
    return [...byId.values()];
  }, [currentUser, listings, myListings]);

  if (!currentUser || flagged.length === 0) return null;

  const confirmDelete = async (listingId: string) => {
    setDeletingId(listingId);
    try {
      await removeListing(listingId);
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <section aria-label={t('assistant.notice.regionLabel')} className="relative z-50">
      {flagged.map((listing) => (
        <div
          key={listing.id}
          role="alert"
          className="border-b border-danger/40 bg-danger-soft"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 rounded-lg bg-danger/15 p-2 text-danger">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="pt-0.5">
                  <h3 className="text-sm font-bold leading-tight text-danger sm:text-base">
                    {t('assistant.notice.title')}
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-muted sm:text-sm">
                    {t('assistant.notice.body', {
                      title: listing.title,
                      reason:
                        listing.moderationNote?.trim() ||
                        t('assistant.notice.defaultReason'),
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex w-full shrink-0 items-center gap-2 sm:mt-0 sm:w-auto">
                {pendingDeleteId === listing.id ? (
                  <>
                    <span className="text-xs font-semibold text-content">
                      {t('assistant.notice.confirmDelete')}
                    </span>
                    <Button
                      variant="secondary"
                      className="px-4 py-2 text-sm"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      {t('common.action.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      loading={deletingId === listing.id}
                      className="px-4 py-2 text-sm"
                      onClick={() => {
                        void confirmDelete(listing.id);
                      }}
                    >
                      {t('common.action.confirm')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      className="flex-1 px-4 py-2 text-sm sm:flex-none"
                      onClick={() => setCurrentView('MY_LISTINGS')}
                    >
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                      {t('assistant.notice.fix')}
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1 px-4 py-2 text-sm sm:flex-none"
                      onClick={() => setPendingDeleteId(listing.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {t('common.action.delete')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default GlobalAINotification;
