import { redirect } from '@/i18n/routing';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * The locale root is not a page — it exists only to hand visitors to the
 * dashboard. The redirect comes from `@/i18n/routing` rather than
 * `next/navigation` so the locale prefix survives the hop; the plain Next
 * helper would drop it and bounce the user back through the proxy.
 */
export default async function RootPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: '/dashboard', locale });
}
