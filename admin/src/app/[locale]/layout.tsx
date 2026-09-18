import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/providers';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import "../globals.css";

// The two faces the design is set in. next/font writes each onto <html> as a
// CSS variable; globals.css reads them first and falls back to the local
// name, so a font that fails to load degrades to the same family by name.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-heading-next',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-next',
  display: 'swap',
});

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
    <html lang={locale} suppressHydrationWarning data-theme="light" className={`${plusJakarta.variable} ${inter.variable}`}>
      <head />
      <body suppressHydrationWarning>
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
