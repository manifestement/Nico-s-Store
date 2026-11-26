/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base relative + HashRouter : l'appli fonctionne sur GitHub Pages quel que soit le nom du dépôt.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sneakers Nico',
        short_name: 'Sneakers',
        description: 'Suivi de la collection de sneakers',
        lang: 'fr',
        display: 'standalone',
        start_url: './',
        scope: './',
        background_color: '#070B16',
        theme_color: '#070B16',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Polices : seuls les jeux latins sont mis en cache pour le hors-ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}', '**/*latin*.woff2'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
  },
})
