'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { CHART_BODY_CLASS, ChartEmpty, ChartError } from './chart-shared';

/**
 * One chart on /analytics: a title, whatever control belongs to it, the plot,
 * and the figures the plot is a picture of.
 *
 * The dashboard could not give a chart this much room — four stacked plots
 * with their own headings and their own summary rails is most of a phone
 * screen each, which is why the overview kept its three time series behind a
 * segmented switcher. A page whose entire subject is the charts has room to
 * spend, so here each one is a card of its own with its own title, its own
 * empty state and its own retry: a failed districts read no longer takes the
 * traffic chart down with it, and retrying one does not refetch the other
 * three.
 *
 * The three non-chart states are the ones `chart-shared` insists on keeping
 * apart — loading, "the endpoint answered with nothing", and "the request
 * failed" are three different facts and only the last one offers a retry. All
 * three occupy the same height as the plot, so a card cannot resize under the
 * reader as its query lands.
 */

export interface SummaryGroup {
  /** Stable list key; also the measure's id. */
  key: string;
  /** The measure's translated name — what the figures are figures OF. Omitted
   *  when the card has only one measure and its title already names it. */
  label?: string;
  /** Whole translated phrases ("18 a day on average"), already formatted in
   *  the reader's locale. Sentences rather than label/value pairs, because
   *  that is the shape the `analytics.summary.*` strings are written in. */
  figures: string[];
}

interface AnalyticsCardProps {
  title: string;
  /** A control or a count, on the header row opposite the title. */
  trailing?: ReactNode;
  loading: boolean;
  /** The request failed — NOT the same thing as a period with no activity. */
  error: boolean;
  /** The request SUCCEEDED and came back with nothing. */
  empty: boolean;
  onRetry: () => void;
  /** Replaces the plot-sized shimmer while loading, for the one chart whose
   *  real shape is a list of rows rather than a 240px block. */
  skeleton?: ReactNode;
  /** Dropped whenever there is nothing measured: an average over no
   *  measurements is not a figure that can be shown. */
  summary?: SummaryGroup[];
  children: ReactNode;
  className?: string;
}

export function AnalyticsCard({
  title,
  trailing,
  loading,
  error,
  empty,
  onRetry,
  skeleton,
  summary,
  children,
  className = '',
}: AnalyticsCardProps) {
  const t = useTranslations('analytics');
  const c = useTranslations('common');

  const showFigures = !loading && !error && !empty && summary !== undefined && summary.length > 0;

  return (
    <div className={`card card-cut-bl flex h-full flex-col p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h2 className="min-w-0 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        {trailing}
      </div>

      <div className="mt-4">
        {loading ? (
          (skeleton ?? <div className={`skeleton ${CHART_BODY_CLASS}`} />)
        ) : error ? (
          <ChartError text={t('loadError')} retryLabel={c('retry')} onRetry={onRetry} />
        ) : empty ? (
          <ChartEmpty text={t('noData')} />
        ) : (
          children
        )}
      </div>

      {showFigures && (
        <div
          className="mt-auto flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t pt-4 text-[12px]"
          style={{ borderColor: 'var(--color-border-light)' }}
        >
          {summary.map((group) => (
            <span key={group.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {group.label && (
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {group.label}
                </span>
              )}
              {group.figures.map((figure, index) => (
                <span key={figure} style={{ color: 'var(--color-text-secondary)' }}>
                  {/* A separator rather than whitespace alone: three short
                      phrases in a row read as one long sentence otherwise. */}
                  {index > 0 && (
                    <span aria-hidden="true" className="pr-2" style={{ color: 'var(--color-border)' }}>
                      ·
                    </span>
                  )}
                  {figure}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
