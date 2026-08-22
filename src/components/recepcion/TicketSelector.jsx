export function TicketSelector({ salas, misTurnos, cargando, onPedirTurno }) {
  const tieneTurnosActivos = misTurnos.some(
    (t) => t.estado === 'espera' || t.estado === 'llamado'
  )

  return (
    <div className="recepcion-selector-container">
      <h2 className="recepcion-selector-title">
        {tieneTurnosActivos ? '¿Necesita otra consulta?' : 'Seleccione la consulta:'}
      </h2>

      <div className="recepcion-room-buttons">
        {salas.map((sala) => {
          const yaTieneTurno = misTurnos.some(
            (t) => t.cola_id === sala.id && (t.estado === 'espera' || t.estado === 'llamado')
          )

          return (
            <button
              key={sala.id}
              onClick={() => onPedirTurno(sala)}
              disabled={cargando || yaTieneTurno}
              className={`recepcion-room-btn ${yaTieneTurno ? 'recepcion-room-btn-active' : ''}`}
            >
              {sala.nombre}
              {yaTieneTurno && (
                <span className="recepcion-room-btn-badge">✓ Turno activo</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
