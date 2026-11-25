import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Workbox fingerprints the public assets. The plugin adds the manifest separately.
      includeManifestIcons: false,
      workbox: {
        globIgnores: ['**/ocr/**', '**/ocr-engine-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (/\/ocr\//.test(url.pathname) ||
                /\/ocr-engine-[^/]+\.js$/.test(url.pathname)),
            handler: 'CacheFirst',
            options: { cacheName: 'pocket-ocr-v1' },
          },
        ],
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webp,jpg,json}',
          'licenses/*.txt',
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        id: './',
        name: '3DS RNG Pocket',
        short_name: '3DS RNG',
        description:
          'Mobile RNG tools for Pokémon X, Y, Omega Ruby, Alpha Sapphire, Sun, Moon, Ultra Sun and Ultra Moon. Frame searches work offline after the first load. Save/ID clock seed lookup requires internet.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'any',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames(asset) {
          const name = asset.names[0] ?? '';
          if (name === 'eng.traineddata.gz')
            return 'ocr/[hash]/eng.traineddata.gz';
          if (name === 'worker.min.js' || name.endsWith('.wasm.js'))
            return 'ocr/[hash]/[name][extname]';
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks(id) {
          if (
            /node_modules\/(tesseract\.js|regenerator-runtime|is-url|bmp-js|idb-keyval)\//.test(
              id,
            )
          )
            return 'ocr-engine';
          if (id.includes('node_modules')) return 'vendor';
          if (/\/generated\/(personal_oras|stationary_gen6)\.json$/.test(id))
            return 'gen6-data';
          if (id.includes('src/data/generated')) return 'usum-data';
          return undefined;
        },
      },
    },
  },
});
