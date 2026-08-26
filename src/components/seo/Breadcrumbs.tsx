/**
 * The visible breadcrumb trail.
 *
 * It exists twice over: as real anchors, which is how a crawler learns the
 * site's shape and how a visitor gets back up a level, and as
 * `BreadcrumbList` JSON-LD written by `buildHead`, which is what Google shows
 * in place of the raw URL under a result. Both are built from the same
 * `crumbs` array, so the trail on screen and the trail in the search result
 * can never say different things.
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';

import type { Crumb } from '../../seo/jsonld';
import { AppLink } from '../../router/AppLink';

interface BreadcrumbsProps {
  crumbs: Crumb[];
  label: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ crumbs, label }) => {
  if (crumbs.length < 2) return null;

  return (
    <nav aria-label={label} className="mb-4">
      <ol className="hide-scrollbar flex items-center gap-1 overflow-x-auto text-xs text-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex shrink-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-subtle" aria-hidden="true" />
              )}
              {isLast ? (
                <span className="max-w-[16rem] truncate font-bold text-content" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <AppLink
                  to={crumb.path}
                  className="max-w-[12rem] truncate transition-colors hover:text-brand-text hover:underline"
                >
                  {crumb.name}
                </AppLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
