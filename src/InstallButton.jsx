import { useState, useEffect } from 'react';

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Comprobar si la app ya está instalada (para no mostrar el botón)
    const checkIsInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (checkIsInstalled) {
      setIsInstalled(true);
      return;
    }

    // 2. Detectar si es un iPhone/iPad (iOS)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    if (isAppleDevice) {
      setIsIOS(true);
    }

    // 3. Capturar el evento de instalación en Android / PC
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Evita el banner automático de Chrome
      setDeferredPrompt(e); // Guarda el evento para nuestro botón
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('App instalada con éxito');
    }
    setDeferredPrompt(null); // Oculta el botón tras usarlo
  };

  // Si ya está instalada, no renderizamos nada
  if (isInstalled) return null;

  // Si es un iPhone, mostramos instrucciones de texto (ya que Apple bloquea el botón)
  if (isIOS) {
    return (
      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', color: 'white', textAlign: 'center', margin: '20px' }}>
        <p style={{ margin: 0, fontSize: '14px' }}>
          🍏 <strong>Para instalar en iPhone:</strong> Pulsa el botón de <strong>Compartir</strong> (el cuadrado con la flecha) en la barra inferior y selecciona <strong>"Añadir a la pantalla de inicio"</strong>.
        </p>
      </div>
    );
  }

  // Si es Android/PC y el evento está listo, mostramos el botón
  if (deferredPrompt) {
    return (
      <div style={{ textAlign: 'center', margin: '20px' }}>
        <button 
          onClick={handleInstallClick}
          style={{
            backgroundColor: '#38bdf8',
            color: '#1e293b',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}
        >
          📲 Instalar App para recibir avisos
        </button>
      </div>
    );
  }

  return null;
}