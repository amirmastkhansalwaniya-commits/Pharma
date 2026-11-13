import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'ROYAL KING VET PHARMA',
          short_name: 'RK VetPharma',
          description:
            'Offline-first GST billing, inventory, customer ledger, and PDF invoicing PWA for ROYAL KING VET PHARMA.',
          theme_color: '#0F4C3A',
          background_color: '#F8FAFC',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['business', 'finance', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              urlPattern: ({request}) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-pages',
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({request, url}) =>
                !url.pathname.startsWith('/@') &&
                !url.pathname.startsWith('/src/') &&
                !url.pathname.startsWith('/node_modules/') &&
                (request.destination === 'script' ||
                  request.destination === 'style' ||
                  request.destination === 'font' ||
                  request.destination === 'image'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets-v2',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      {
        name: 'safe-pwa-dev-hmr',
        apply: 'serve',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const withoutDevReady = html.replace(
              /<script id="vite-plugin-pwa:register-dev-sw"[\s\S]*?<\/script>/g,
              '',
            );
            return withoutDevReady.replace(
              '</body>',
              `<script type="module">if('caches'in window){caches.delete('static-assets').catch(()=>{});}if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then((regs)=>regs.forEach((r)=>r.update().catch(()=>{}))).catch(()=>{});}</script></body>`,
            );
          },
        },
        transform(code, id) {
          if (id.includes('pwa-entry-point-loaded') && code.includes('import.meta.hot.send(')) {
            const guarded = code.replace(
              /import\.meta\.hot\.send\(([^)]+)\);/g,
              'if (window.__rkvpViteWsConnected) import.meta.hot?.send?.($1);',
            );
            return {
              code: `if (import.meta.hot) { import.meta.hot.on('vite:ws:connect', () => { window.__rkvpViteWsConnected = true; import.meta.hot?.send?.('vite-pwa-plugin:dev-ready'); }); }\n${guarded}`,
              map: null,
            };
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
