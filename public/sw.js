// public/sw.js

// --- Forzar actualización y toma de control inmediata ---
self.addEventListener('install', () => {
  self.skipWaiting() // Obliga al nuevo Service Worker a instalarse de inmediato
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()) // Toma el control de la PWA al instante
})
// --------------------------------------------------------

// 1. Escuchar cuando llega la notificación Push desde el servidor (Edge Function)
self.addEventListener('push', (event) => {
  let data = {
    title: '¡Es su turno!',
    body: 'Por favor, acuda a la consulta indicada en la pantalla.',
    tipo: 'llamado',
  }

  try {
    if (event.data) {
      const parsedData = event.data.json()
      if (parsedData.title) data.title = parsedData.title
      if (parsedData.body) data.body = parsedData.body
      if (parsedData.tipo) data.tipo = parsedData.tipo
    }
  } catch (e) {
    console.error('El payload de Supabase no es un JSON válido, usando textos por defecto.', e)
  }

  const esPreaviso = data.tipo === 'preaviso'

  const opciones = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: esPreaviso ? [200, 100, 200] : [500, 200, 500, 200, 500],
    tag: 'turno-alerta',
    renotify: true,
    requireInteraction: !esPreaviso,
    data: {
      url: '/recepcion',
    },
  }

  event.waitUntil(self.registration.showNotification(data.title, opciones))
})

// 2. Al hacer clic en la notificación, abrir o enfocar la web de la clínica
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Buscar si ya hay una pestaña abierta con la app
      for (const client of windowClients) {
        if (client.url.includes('/recepcion') && 'focus' in client) {
          return client.focus()
        }
      }
      // Si la PWA estaba totalmente cerrada en segundo plano, la abre
      if (self.clients.openWindow) {
        return self.clients.openWindow('/recepcion')
      }
    })
  )
})