import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    // Listing photos are arbitrary https:// URLs (or data: URIs) supplied by
    // owners — see _validate_images in the backend — so there is no hostname
    // list to allowlist. Serving them unoptimized keeps next/image from
    // throwing on an unknown host, and a staff-only panel has no traffic worth
    // paying image optimization for.
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    staleTimes: {
      static: 300,
      dynamic: 30,
    },
  },
};

export default withNextIntl(nextConfig);
