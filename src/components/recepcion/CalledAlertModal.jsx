export function CalledAlertModal({ turno, onEntendido, onVolver }) {
  if (!turno) return null

  return (
    <div className="recepcion-called-screen animate-fade-in" role="alert" aria-live="assertive">
      <div className="recepcion-called-badge">¡ES SU TURNO!</div>
      <div className="recepcion-called-number">{turno.numero}</div>
      <div className="recepcion-called-room">
        Por favor, pase a <strong>{turno.sala}</strong>
      </div>
      <p className="recepcion-called-instruction">
        El médico le está esperando en la consulta.
      </p>

      <div className="recepcion-called-actions">
        <button
          onClick={() => onEntendido(turno.id)}
          className="recepcion-called-btn-primary"
        >
          ✓ Entendido, ya voy a consulta
        </button>

        <button
          onClick={() => onVolver(turno.id)}
          className="recepcion-called-btn-secondary"
        >
          Volver a selección de consultas
        </button>
      </div>
    </div>
  )
}
