export function TicketOverlay({ llamadaActiva, salaNombre }) {
  if (!llamadaActiva || !salaNombre) return null

  return (
    <div
      className="pantalla-overlay-llamada animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="pantalla-overlay-subtitle">Nuevo Turno</h2>
      <div className="pantalla-overlay-number">{llamadaActiva.numero}</div>
      <h1 className="pantalla-overlay-instruction">
        Por favor, acuda a <strong className="pantalla-overlay-room-name">{salaNombre}</strong>
      </h1>
    </div>
  )
}
