import path from 'node:path';
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // This app sits inside the site's repository, which has its own
  // package-lock.json one level up. Turbopack infers the workspace root by
  // walking upwards until it finds a lockfile, so left alone it picks the
  // repository root and resolves modules against the wrong node_modules.
  // Pinning it keeps the panel self-contained wherever it is checked out.
  turbopack: {
    root: path.join(__dirname),
  },
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
