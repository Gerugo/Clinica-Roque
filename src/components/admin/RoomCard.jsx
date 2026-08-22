export function RoomCard({
  sala,
  turnoActual,
  enEspera,
  estaCargando,
  onLlamarSiguiente,
  onReLlamar,
  onDescartar,
  onImprimirPapel,
  onEliminarSala,
}) {
  const tieneEspera = enEspera > 0

  return (
    <div className="admin-room-card animate-fade-in">
      <div
        className="admin-room-card-bar"
        style={{
          background: tieneEspera
            ? 'linear-gradient(90deg, #38bdf8, #34d399)'
            : '#475569',
        }}
      />

      <div className="admin-room-header">
        <h2 className="admin-room-title">{sala.nombre}</h2>
        <button
          onClick={() => onEliminarSala(sala.id, sala.nombre)}
          className="admin-room-delete-btn"
          title={`Eliminar ${sala.nombre}`}
        >
          Eliminar
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <div
          className="admin-badge-waiting"
          style={{
            backgroundColor: tieneEspera ? 'rgba(56, 189, 248, 0.12)' : '#0f172a',
            color: tieneEspera ? '#7dd3fc' : '#64748b',
            border: `1px solid ${tieneEspera ? 'rgba(56, 189, 248, 0.25)' : '#334155'}`,
          }}
        >
          <span
            className="admin-dot-indicator"
            style={{
              backgroundColor: tieneEspera ? '#38bdf8' : '#475569',
              animation: tieneEspera ? 'pulse 2s infinite' : 'none',
            }}
          />
          Pacientes en espera: {enEspera}
        </div>
      </div>

      {/* Botón Imprimir Ticket Papel (Diseñado para personas mayores / sin smartphone) */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <button
          onClick={() => onImprimirPapel(sala.id, sala.nombre)}
          disabled={estaCargando}
          className="admin-btn-print"
          title="Generar e imprimir ticket físico para personas mayores o sin smartphone"
        >
          🖨️ Imprimir ticket papel
        </button>
      </div>

      {/* Turno actual en consulta */}
      <div className="admin-current-ticket-box">
        <p className="admin-current-ticket-label">En consulta ahora</p>
        <div
          className="admin-current-ticket-number"
          style={{
            color: turnoActual ? '#34d399' : '#475569',
            textShadow: turnoActual ? '0 0 15px rgba(52, 211, 153, 0.25)' : 'none',
          }}
        >
          {turnoActual ? turnoActual.numero : '-'}
        </div>
      </div>

      {/* Acciones de turno activo */}
      <div className="admin-actions-row">
        {turnoActual && (
          <>
            <button
              onClick={() => onReLlamar(sala.id)}
              disabled={estaCargando}
              className="admin-btn-recall"
              title="Volver a avisar al paciente por pantalla y push"
            >
              🔔 Re-llamar
            </button>
            <button
              onClick={() => onDescartar(sala.id)}
              disabled={estaCargando}
              className="admin-btn-discard"
              title="Descartar este turno"
            >
              ✕ Descartar
            </button>
          </>
        )}
      </div>

      {/* Botón Principal: Llamar Siguiente */}
      <button
        onClick={() => onLlamarSiguiente(sala.id, sala.nombre)}
        disabled={estaCargando || !tieneEspera}
        className="admin-btn-call-next"
        style={{
          background:
            estaCargando || !tieneEspera
              ? '#334155'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: estaCargando || !tieneEspera ? '#64748b' : 'white',
          boxShadow:
            estaCargando || !tieneEspera
              ? 'none'
              : '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
        }}
      >
        {estaCargando ? 'Procesando...' : 'Llamar Siguiente'}
      </button>
    </div>
  )
}
