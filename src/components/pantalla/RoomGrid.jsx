export function RoomGrid({ salas, turnosPorSala }) {
  return (
    <div className="pantalla-grid-wrapper">
      <div className="pantalla-grid">
        {salas.map((sala) => (
          <div key={sala.id} className="pantalla-room-card animate-fade-in">
            <h2 className="pantalla-room-title">{sala.nombre}</h2>
            <div className="pantalla-room-divider" />
            <div className="pantalla-room-number">
              {turnosPorSala[sala.id] || '-'}
            </div>
            <p className="pantalla-room-badge">Turno Actual</p>
          </div>
        ))}
      </div>
    </div>
  )
}
