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
    body: 'Por favor, acuda a la consulta indicada en la pantalla.',
    tipo: 'llamado' // <-- AÑADIDO: asume por defecto que es el turno real
  };

  try {
    if (event.data) {
      // Intentamos parsear. Tu Edge Function envía un JSON con 'title', 'body' y 'tipo'
      const parsedData = event.data.json();
      if (parsedData.title) data.title = parsedData.title;
      if (parsedData.body) data.body = parsedData.body;
      if (parsedData.tipo) data.tipo = parsedData.tipo; // <-- AÑADIDO: capturamos el tipo
    }
  } catch (e) {
    console.error('El payload de Supabase no es un JSON válido, usando textos por defecto.', e);
  }

  // --- LÓGICA DE UX: Evaluamos si es un preaviso o el llamado final ---
  const esPreaviso = data.tipo === 'preaviso';

  const opciones = {
    body: data.body,
    icon: '/pwa-192x192.png', // CRÍTICO: Da legitimidad a la notificación en Android
    badge: '/pwa-192x192.png', // CRÍTICO: Icono monocromo para la barra superior
    
    // MODIFICADO: Vibración suave si es preaviso, agresiva si es el turno real
    vibrate: esPreaviso ? [200, 100, 200] : [500, 200, 500, 200, 500], 
    
    tag: 'turno-alerta', 
    renotify: true,
    
    // MODIFICADO: El preaviso no bloquea la pantalla eternamente, el turno real sí
    requireInteraction: !esPreaviso, 
    
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