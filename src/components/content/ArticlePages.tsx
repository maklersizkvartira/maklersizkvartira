/**
 * The editorial pages: the guide index, a single guide, and the help centre.
 *
 * They exist for the half of the audience that is not yet searching for a
 * specific flat — "ijara shartnomasi nima yozilishi kerak", "zakladka
 * qaytariladimi" — and they are the pages that can earn a link, which a
 * listings grid never will. They also give the landing pages somewhere
 * authoritative to point when a visitor's question is not "where", but "how".
 */

import React, { useMemo } from 'react';
import { ArrowRight, CalendarDays, Clock } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useSeoCopy } from '../../seo/useSeoCopy';
import type { Article, ArticleSection, HelpArticle } from '../../seo/content/types';
import { buildPageCopy } from '../../seo/meta';
import { blogPostPath, helpPath, BLOG_PATH, HELP_PATH } from '../../seo/routes';
import { useSeoHead } from '../../seo/useSeoHead';
import { useAppStore } from '../../stores/useAppStore';
import { AppLink } from '../../router/AppLink';
import { VIEW_PATHS } from '../../router/views';
import { Breadcrumbs } from '../seo/Breadcrumbs';
import { FaqSection, PageIntro } from '../seo/blocks';

const SHELL = 'mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8';

const Sections: React.FC<{ sections: ArticleSection[] }> = ({ sections }) => (
  <>
    {sections.map((section) => (
      <section key={section.heading} className="mt-8">
        <h2 className="text-lg font-black text-content sm:text-xl">{section.heading}</h2>
        <div className="mt-3 space-y-3">
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-sm leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </div>
        {section.bullets && section.bullets.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-sm text-muted">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  aria-hidden="true"
                />
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    ))}
  </>
);

// ---------------------------------------------------------------------------
export const BlogIndexPage: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);
  const page = useMemo(() => buildPageCopy(route, language), [route, language, copy]);

  useSeoHead(route, language);

  return (
    <div className={SHELL}>
      <Breadcrumbs crumbs={page.crumbs} label={t('common.a11y.menu')} />
      <PageIntro h1={page.h1} paragraphs={page.intro} />

      <div className="mt-8 space-y-4">
        {copy.articles.map((article: Article) => (
          <article
            key={article.slug}
            className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
          >
            <h2 className="text-base font-black leading-snug text-content sm:text-lg">
              <AppLink to={blogPostPath(article.slug)} className="hover:text-brand-text">
                {article.title}
              </AppLink>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{article.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-subtle">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {copy.common.readingTime(article.readingMinutes)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const BlogPostPage: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);
  const page = useMemo(() => buildPageCopy(route, language), [route, language, copy]);
  const article = copy.articles.find((item) => item.slug === route.slug);

  useSeoHead(route, language);

  if (!article) return null;

  return (
    <div className={SHELL}>
      <Breadcrumbs crumbs={page.crumbs} label={t('common.a11y.menu')} />

      <article>
        <PageIntro h1={article.h1} paragraphs={[article.intro]} />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-line py-3 text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {copy.common.publishedOn}:{' '}
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {copy.common.readingTime(article.readingMinutes)}
          </span>
        </div>

        <Sections sections={article.sections} />
        <FaqSection heading={copy.common.faqHeading} entries={article.faq} />
      </article>

      <nav aria-label={copy.common.blogHeading} className="mt-10 border-t border-line pt-6">
        <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-subtle">
          {copy.common.blogHeading}
        </h2>
        <ul className="space-y-2">
          {copy.articles
            .filter((item) => item.slug !== article.slug)
            .slice(0, 4)
            .map((item) => (
              <li key={item.slug}>
                <AppLink
                  to={blogPostPath(item.slug)}
                  className="inline-flex items-start gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand-text"
                >
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {item.title}
                </AppLink>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const HelpPage: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);
  const page = useMemo(() => buildPageCopy(route, language), [route, language, copy]);
  const article: HelpArticle | undefined = route.slug
    ? copy.help.find((item) => item.slug === route.slug)
    : undefined;

  useSeoHead(route, language);

  return (
    <div className={SHELL}>
      <Breadcrumbs crumbs={page.crumbs} label={t('common.a11y.menu')} />
      <PageIntro h1={page.h1} paragraphs={page.intro} />

      {article ? (
        <>
          <Sections sections={article.sections} />
          <p className="mt-8 text-[11px] text-subtle">
            {copy.common.updatedOn}:{' '}
            <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
          </p>
        </>
      ) : (
        <div className="mt-8 space-y-4">
          {copy.help.map((item) => (
            <article
              key={item.slug}
              className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
            >
              <h2 className="text-base font-black text-content">
                <AppLink to={helpPath(item.slug)} className="hover:text-brand-text">
                  {item.title}
                </AppLink>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
/**
 * A real 404.
 *
 * The previous build answered every unknown path with the listings page at
 * HTTP 200 — a soft 404, which Google reports as an error and which hides
 * genuinely broken links from everybody. The status code still cannot be 404
 * on a static host, so the page says so in its `<title>`, marks itself
 * `noindex`, and offers the way back.
 */
export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const route = useAppStore((state) => state.route);
  const language = useAppStore((state) => state.language);
  const copy = useSeoCopy(language);

  useSeoHead(route, language, { noindex: true });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
      <p className="text-5xl font-black text-brand">404</p>
      <h1 className="mt-4 text-xl font-black text-content sm:text-2xl">
        {copy.common.notFoundTitle}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        {copy.common.notFoundBody}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <AppLink
          to={VIEW_PATHS.LISTINGS ?? '/elonlar'}
          className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-on-brand shadow-brand"
        >
          {copy.common.notFoundCta}
        </AppLink>
        <AppLink
          to={BLOG_PATH}
          className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-content transition-colors hover:bg-surface-2"
        >
          {copy.common.blogHeading}
        </AppLink>
        <AppLink
          to={HELP_PATH}
          className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-bold text-content transition-colors hover:bg-surface-2"
        >
          {t('layout.nav.help')}
        </AppLink>
      </div>
    </div>
  );
};
