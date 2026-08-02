// public/sw.js

// --- NUEVAS ÓRDENES: Forzar actualización y toma de control inmediata ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Obliga al nuevo Service Worker a instalarse de inmediato, matando al antiguo
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Toma el control de la PWA al instante sin esperar a recargar
});
// ------------------------------------------------------------------------

// 1. Escuchar cuando llega la notificación Push desde el servidor (Edge Function)
self.addEventListener('push', (event) => {
  // Datos por defecto ultra-seguros
  let data = { 
    title: '¡Es su turno!', 
    body: 'Por favor, acuda a la consulta indicada en la pantalla.' 
  };

  try {
    if (event.data) {
      // Intentamos parsear. Tu Edge Function DEBE enviar un JSON con 'title' y 'body'
      const parsedData = event.data.json();
      if (parsedData.title) data.title = parsedData.title;
      if (parsedData.body) data.body = parsedData.body;
    }
  } catch (e) {
    console.error('El payload de Supabase no es un JSON válido, usando textos por defecto.', e);
  }

  const opciones = {
    body: data.body,
    icon: '/pwa-192x192.png', // CRÍTICO: Da legitimidad a la notificación en Android
    badge: '/pwa-192x192.png', // CRÍTICO: Icono monocromo para la barra superior
    vibrate: [500, 200, 500, 200, 500], // Patrón más agresivo para pantallas bloqueadas
    tag: 'turno-alerta', 
    renotify: true,
    requireInteraction: true, 
    data: {
      url: '/recepcion' 
    }
  };

  // Forzamos al sistema operativo a esperar a que la notificación se levante
  event.waitUntil(
    self.registration.showNotification(data.title, opciones)
  );
});

// 2. Al hacer clic en la notificación, abrir o enfocar la web de la clínica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Buscar si ya hay una pestaña abierta con la app
      for (let client of windowClients) {
        if (client.url.includes('/recepcion') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si la PWA estaba totalmente cerrada en segundo plano, la abre
      if (clients.openWindow) {
        return clients.openWindow('/recepcion');
      }
    })
  );
});
