import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Actualiza la app automáticamente en los móviles cuando subas cambios
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Clínica Roque - Turnos',
        short_name: 'Turnos',
        description: 'Gestión inteligente de sala de espera',
        theme_color: '#000000', // Pon aquí el color principal de tu UI
        background_color: '#ffffff',
        display: 'standalone', // ESTO ES CLAVE: Oculta la barra de direcciones del navegador
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})