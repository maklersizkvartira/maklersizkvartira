import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Uyiz Admin', template: '%s · Uyiz Admin' },
  // Staff-only surface — it should never turn up in a search result.
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
