// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Read the version once at config load — surfaced on the Home/End source
// footer (spec §27) so a returning visitor can tell whether their cached
// PWA shell has picked up a deploy. See backlog item 16 (stale cache) /
// item 17 (visible version label).
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };
const BUILD_DATE = new Date().toISOString().slice(0, 10);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Public assets to add to the precache (spec §13 names monkeys-on-bus.png).
      includeAssets: ['monkeys-on-bus.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Funny Stories',
        short_name: 'FunnyStories',
        description: 'Write absurd stories together, then watch an AI cartoon them.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#fef3c7',
        background_color: '#fef3c7',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Precache hashed assets only — index.html is intentionally NOT in
        // the precache so a fresh navigation always picks up the latest
        // shell (spec §13). Socket.IO traffic and base64 image data URLs
        // are also never cached.
        globPatterns: ['**/*.{js,css,png,svg,webmanifest}'],
        // Disable the default precached-index.html fallback for SPA
        // navigations — the NetworkFirst rule below handles them.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/],
        runtimeCaching: [
          {
            // Navigation requests (`/`, `/anything`) — NetworkFirst so a
            // deploy is visible on the next page open. Falls back to the
            // cache only when the network is slow or unreachable, which
            // for a multiplayer game is already a degraded mode.
            // Fixes backlog item 16 (stale cached app shell after deploy).
            urlPattern: ({ request }: { request: Request }) =>
              request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4 },
            },
          },
          {
            // Google Fonts stylesheet — revalidate in the background.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // Google Fonts files — immutable, cache for a year.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
