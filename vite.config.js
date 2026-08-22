import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest', 
      srcDir: 'public', // Tu sw.js se queda en la carpeta public
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined 
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Clínica Roque - Turnos',
        short_name: 'Turnos',
        description: 'Gestión inteligente de sala de espera',
        theme_color: '#000000', 
        background_color: '#ffffff',
        display: 'standalone', 
        start_url: '/recepcion', 
        scope: '/', // CLAVE: Cambiado a la raíz para no romper la caché
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
