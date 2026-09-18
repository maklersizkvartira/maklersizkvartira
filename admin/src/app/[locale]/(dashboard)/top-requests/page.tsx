'use client';

/** The old address of the Top requests page: opens the listings hub on its tab. */
import { ListingsHub } from '@/features/hubs/ListingsHub';

export default function TopRequestsPage() {
  return <ListingsHub initialTab="top" />;
}
