import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    // Proxying keeps the dev origin identical to production, so the API can be
    // addressed as a same-origin /api/v1 path and CORS never enters the picture.
    // The admin panel used to be proxied here too, back when the backend
    // served it as a static bundle. It is its own Next.js app in `admin/`
    // now, on its own port and its own deployment, so proxying /admin from
    // the site would only shadow a route the site may one day want.
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
  // `vite preview` serves the production bundle; it needs the same proxy as dev
  // so the built app can be exercised against a local API before deploying.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5060', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // The SSR pass builds `src/entry-server.tsx` into `.prerender/`, which
    // `scripts/prerender.mjs` imports to produce the static HTML. It is a
    // build artefact, not something the site serves, so it never goes in dist.
    ...(isSsrBuild
      ? { outDir: '.prerender', ssr: 'src/entry-server.tsx', emptyOutDir: true }
      : {}),
    rollupOptions: {
      output: {
        // Split the heaviest third-party code so a change to app code does not
        // invalidate the whole vendor bundle in users' caches. Vite 8 bundles
        // with rolldown, which takes the function form only.
        //
        // Chunking is skipped for the SSR build: there is one consumer, it is
        // a Node script, and splitting it would only make the import harder.
        manualChunks: isSsrBuild
          ? undefined
          : (id: string) => {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
              if (id.includes('react-dom') || id.includes('/react/')) return 'react';

              // These are loaded on demand by exactly one screen each, and a
              // catch-all `return 'vendor'` undoes that: it drags them into
              // the chunk the entry already depends on, so the map library
              // ended up modulepreloaded on the home page — 259KB gzipped,
              // in front of the first paint, for a view most visitors never
              // open. Their own chunks stay lazy.
              if (id.includes('maplibre-gl')) return 'maplibre';
              if (id.includes('framer-motion')) return 'motion';
              if (id.includes('canvas-confetti')) return 'confetti';
              if (id.includes('@phosphor-icons')) return 'phosphor';

              return 'vendor';
            },
      },
    },
  },
}));
