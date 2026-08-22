export function AudioPermissionModal({ onActivar }) {
  return (
    <div className="pantalla-audio-gate animate-fade-in" role="dialog" aria-modal="true">
      <h2 className="pantalla-audio-gate-title">Sistema de Turnos</h2>
      <p className="pantalla-audio-gate-desc">
        Pulse para activar el sonido y conectar con la pantalla de Clínica Roque.
      </p>
      <button
        onClick={onActivar}
        className="pantalla-audio-gate-btn"
        autoFocus
      >
        ▶ Activar Pantalla
      </button>
    </div>
  )
}
