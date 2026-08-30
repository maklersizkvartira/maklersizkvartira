import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * The tab title is the one thing on this route that a Russian-speaking admin
 * sees before signing in, so it follows the locale rather than being a fixed
 * Uzbek literal.
 *
 * Two details that the obvious version gets wrong:
 *
 *  · The locale is passed explicitly. `generateMetadata` runs outside the
 *    render's request-locale scope, so the namespace-only overload can resolve
 *    against the default locale and quietly reproduce the bug it is fixing.
 *  · The title is returned bare. The root layout's `title.template` appends
 *    "| Uyiz Admin"; the old literal carried its own "| Uyiz" as well, so the
 *    tab read the brand twice.
 *
 * The description is gone rather than translated: `robots` keeps this page out
 * of every index and preview, so nothing renders it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('signIn'),
    // Staff-only surface — it should never turn up in a search result.
    robots: { index: false, follow: false },
  };
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, var(--accent-subtle) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, var(--accent-subtle) 0%, transparent 50%), var(--color-surface-2)',
      }}
    >
      {/* Animated grid bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Blur blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '600px', height: '600px',
          top: '-150px', left: '-150px',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.5,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: '500px', height: '500px',
          bottom: '-100px', right: '-100px',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.3,
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  );
}
