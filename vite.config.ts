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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,json}', 'licenses/*.txt'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        id: './',
        name: '3DS RNG Pocket',
        short_name: '3DS RNG',
        description: 'Mobile RNG tools for Pokémon Sun, Moon, Ultra Sun and Ultra Moon. Frame searches work offline after the first load. Save/ID clock seed lookup requires internet.',
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
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (/\/generated\/(personal_oras|stationary_gen6)\.json$/.test(id)) return 'gen6-data';
          if (id.includes('src/data/generated')) return 'usum-data';
          return undefined;
        },
      },
    },
  },
});
