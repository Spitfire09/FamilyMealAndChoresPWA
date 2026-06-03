import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'app-icon.svg'],
      manifest: {
        name: 'FamilieMad & Pligter',
        short_name: 'FamilieMad',
        description:
          'Lokal PWA til planlægning af aftensmad og registrering af huslige pligter.',
        theme_color: '#155eef',
        background_color: '#f4f7fb',
        display: 'standalone',
        start_url: '/',
        lang: 'da',
        icons: [
          {
            src: 'app-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
