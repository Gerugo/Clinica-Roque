export function QueueStatus({ turnosEnEspera, posiciones, etasMins }) {
  if (!turnosEnEspera || turnosEnEspera.length === 0) return null

  return (
    <div className="recepcion-active-tickets">
      {turnosEnEspera.map((turno) => {
        const personasAdelante = posiciones[turno.id] ?? '...'
        const minutosEstimados = etasMins[turno.id] ?? '...'
        const esSiguiente = personasAdelante === 0

        return (
          <div key={turno.id} className="recepcion-ticket-card animate-fade-in">
            <div className="recepcion-ticket-card-header">{turno.sala}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
              Su turno asignado es:
            </div>
            <div className="recepcion-ticket-number">{turno.numero}</div>

            {/* Rejilla de métricas dinámicas */}
            <div className="recepcion-metrics-grid">
              <div className="recepcion-metric-item">
                <div className="recepcion-metric-val">{personasAdelante}</div>
                <div className="recepcion-metric-label">
                  {personasAdelante === 1 ? 'Persona delante' : 'Personas delante'}
                </div>
              </div>

              <div className="recepcion-metric-item">
                <div className="recepcion-metric-val">
                  {typeof minutosEstimados === 'number'
                    ? `~${minutosEstimados} min`
                    : minutosEstimados}
                </div>
                <div className="recepcion-metric-label">Tiempo estimado</div>
              </div>
            </div>

            {esSiguiente && (
              <p className="recepcion-next-badge">
                🔔 ¡Prepárese, es el siguiente en entrar!
              </p>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #e0f2fe',
                  borderTop: '2px solid #0284c7',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
