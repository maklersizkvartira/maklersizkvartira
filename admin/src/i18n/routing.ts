import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // Uzbek first and as the default: Uyiz staff are Uzbek-speaking and the
  // backend's own error strings fall back to uz, so a mismatched default would
  // show a Russian shell around Uzbek server messages.
  locales: ['uz', 'ru', 'en'],
  defaultLocale: 'uz',
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
