import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/providers';
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: 'Uyiz Admin',
    template: '%s | Uyiz Admin',
  },
  description:
    "Uyiz ijara platformasi uchun boshqaruv paneli: eʼlonlar moderatsiyasi, foydalanuvchilar va tizim jurnallari.",
  icons: { icon: '/brand/favicon.ico' },
  // A staff-only console has nothing to gain from search traffic and plenty to
  // lose: listing IDs and usernames leak through indexed URLs. vercel.json
  // sends the matching X-Robots-Tag header for assets this meta tag cannot cover.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning data-theme="dark">
      <head />
      <body suppressHydrationWarning>
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
