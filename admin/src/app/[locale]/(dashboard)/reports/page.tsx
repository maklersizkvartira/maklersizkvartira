'use client';

/** The old address of the reports page: opens the listings hub on its tab. */
import { ListingsHub } from '@/features/hubs/ListingsHub';

export default function ReportsPage() {
  return <ListingsHub initialTab="reports" />;
}
