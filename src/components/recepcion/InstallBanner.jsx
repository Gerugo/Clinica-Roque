import { usePwaInstall } from '../../hooks/usePwaInstall.js'

export function InstallBanner() {
  const { puedeInstalar, esApple, instalarApp } = usePwaInstall()

  if (esApple) {
    return (
      <div className="recepcion-pwa-banner-ios animate-fade-in" role="complementary">
        🍏 <strong>Para instalar en tu iPhone / iPad:</strong> Pulsa el botón de{' '}
        <strong>Compartir</strong> (icono de cuadrado con la flecha hacia arriba) en Safari y
        selecciona <strong>"Añadir a la pantalla de inicio"</strong>.
      </div>
    )
  }

  if (puedeInstalar) {
    return (
      <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
        <button
          onClick={instalarApp}
          className="recepcion-pwa-banner-btn"
          title="Instalar la aplicación para recibir avisos de turno"
        >
          📲 Instalar App para recibir avisos
        </button>
      </div>
    )
  }

  return null
}
