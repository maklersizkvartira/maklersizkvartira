/**
 * A geography or category landing page.
 *
 * Three things have to be true at once for one of these to be worth having,
 * and the component is arranged around them:
 *
 *  1. It answers the search. The heading, the opening paragraphs and the FAQ
 *     are specific to this district or this category and appear nowhere else.
 *  2. It shows the goods. A live, filtered grid of real listings — a landing
 *     page that only talks about flats is a doorway page.
 *  3. It goes somewhere. Sibling districts, sibling categories and the parent
 *     region are all one click away, which is what makes a hundred generated
 *     pages a structure rather than a hundred orphans.
 *
 * A page that turns out to have no listings takes itself out of the index —
 * see `resultCount` below — while staying crawlable, so its links still pass
 * through to the pages that do have something on them.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { buildPageCopy } from '../../seo/meta';
import { relatedLinks } from '../../seo/links';
import { useSeoHead } from '../../seo/useSeoHead';
import { useSeoCopy } from '../../seo/useSeoCopy';
import { useAppStore } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { ListingsApi } from '../../services/listingsApi';
import { ApiError } from '../../services/http';
import { Button } from '../ui/Field';
import { ListingCard, ListingCardSkeleton } from '../listings/ListingCard';
import { AppLink } from '../../router/AppLink';
import { VIEW_PATHS } from '../../router/views';
import { Breadcrumbs } from './Breadcrumbs';
import { FaqSection, Highlights, LinkGroups, PageIntro } from './blocks';

const PAGE_SIZE = 24;

export const SeoLandingPage: React.FC = () => {
  const { t, formatNumber } = useTranslation();
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);

  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const copy = useSeoCopy(language);
  const page = useMemo(() => buildPageCopy(route, language), [route, language, copy]);
  const groups = useMemo(() => relatedLinks(route, language), [route, language, copy]);

  const profile = route.district
    ? copy.places.districts[route.district.slug]
    : route.region
      ? copy.places.regions[route.region.slug]
      : undefined;

  const eyebrow = route.category ? copy.categories[route.category.key]?.label : undefined;

  // The facet is the whole identity of the page, so the query is keyed on it
  // rather than on the path — two routes that filter identically would
  // otherwise refetch the same rows.
  const filterKey = JSON.stringify(route.filters);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    ListingsApi.list({ ...route.filters, pageSize: PAGE_SIZE, sortBy: 'RECOMMENDED' })
      .then((result) => {
        if (cancelled) return;
        setListings(result.data);
        setTotal(result.totalCount);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListings([]);
        // A failed request is not evidence that the facet is empty, so the
        // count stays undefined and the page keeps its `index` directive.
        setTotal(undefined);
        setStatus(error instanceof ApiError ? 'error' : 'error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, reloadToken]);

  useSeoHead(route, language, { resultCount: total, sample: listings });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs crumbs={page.crumbs} label={t('common.a11y.menu')} />

      <PageIntro h1={page.h1} paragraphs={page.intro} eyebrow={eyebrow} />
      <Highlights items={profile?.highlights ?? []} />

      {/* ------------------------------------------------------------- */}
      <section className="mt-8" aria-labelledby="seo-results-heading">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="seo-results-heading" className="text-lg font-black text-content sm:text-xl">
            {copy.common.listingsIn(page.h1)}
          </h2>
          {total !== undefined && status === 'ready' ? (
            <p className="shrink-0 text-xs font-semibold text-subtle">
              {copy.common.resultsCount(total)}
            </p>
          ) : null}
        </div>

        {status === 'loading' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ListingCardSkeleton key={index} />
            ))}
          </div>
        ) : status === 'error' ? (
          <div className="rounded-2xl border border-danger/30 bg-danger-soft p-8 text-center">
            <p className="text-sm font-bold text-danger">{t('common.error.network')}</p>
            <Button
              variant="secondary"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('common.error.tryAgain')}
            </Button>
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center sm:p-10">
            <h3 className="text-base font-black text-content">{copy.common.emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">{copy.common.emptyBody}</p>
            <AppLink
              to={VIEW_PATHS.LISTINGS ?? '/elonlar'}
              className="mt-5 inline-flex items-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand shadow-brand"
            >
              {copy.common.allListings}
            </AppLink>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} priority={index < 4} />
              ))}
            </div>
            {total !== undefined && total > listings.length ? (
              <div className="mt-6 flex justify-center">
                <AppLink
                  to={VIEW_PATHS.LISTINGS ?? '/elonlar'}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-content transition-colors hover:bg-surface-2"
                >
                  <Loader2 className="h-4 w-4" aria-hidden="true" />
                  {t('common.action.loadMore')} ({formatNumber(total)})
                </AppLink>
              </div>
            ) : null}
          </>
        )}
      </section>

      <LinkGroups heading={copy.common.exploreHeading} groups={groups} />
      <FaqSection heading={copy.common.faqHeading} entries={page.faq} />
    </div>
  );
};

export default SeoLandingPage;
