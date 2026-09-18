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
    <div className="auth-shell min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
