import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const appVersion = process.env.VITE_APP_VERSION ?? new Date().toISOString()
const basePath = process.env.VITE_BASE_PATH ?? '/'
const cacheVersion = appVersion.replace(/[^a-zA-Z0-9-]/g, '-')

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg', 'icon-192x192.png', 'icon-512x512.png'],
      workbox: {
        cacheId: `family-meal-and-chores-${cacheVersion}`,
      },
      manifest: {
        name: 'FamilieMad & Pligter',
        short_name: 'FamilieMad',
        description:
          'Lokal PWA til planlægning af aftensmad og registrering af huslige pligter.',
        theme_color: '#155eef',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: basePath,
        scope: basePath,
        lang: 'da',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
