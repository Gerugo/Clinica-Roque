// public/sw.js

// 1. Escuchar cuando llega la notificación Push desde el servidor
self.addEventListener('push', (event) => {
  let data = { title: '¡Su turno!', body: 'Es momento de entrar a la consulta.' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.log('Error parseando datos push:', e);
  }

  const opciones = {
    body: data.body,
    vibrate: [300, 100, 300, 100, 300], // Patrón de vibración
    tag: 'turno-alerta', // Evita que se acumulen notificaciones duplicadas
    renotify: true,
    requireInteraction: true, // Obliga a que el paciente interactúe para que desaparezca
    silent: false,            // Pide explícitamente al OS que no la silencie
    data: {
      url: '/recepcion'       // Ruta a la que navegará al hacer clic
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, opciones)
  );
});

// 2. Al hacer clic en la notificación, abrir o enfocar la web de la clínica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        // Si la PWA ya está abierta en segundo plano, la trae al frente
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Si la PWA estaba totalmente cerrada, la abre en la recepción
      if (clients.openWindow) {
        return clients.openWindow('/recepcion');
      }
    })
  );
});