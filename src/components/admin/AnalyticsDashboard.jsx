import { useState, useEffect, useCallback } from 'react'
import { obtenerMetricasClinica } from '../../services/analytics.js'
import { LoadingSpinner } from '../common/LoadingSpinner.jsx'

export function AnalyticsDashboard() {
  const [rango, setRango] = useState('hoy')
  const [metricas, setMetricas] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    const data = await obtenerMetricasClinica(rango)
    setMetricas(data)
    setCargando(false)
  }, [rango])

  useEffect(() => {
    let activo = true

    obtenerMetricasClinica(rango).then((data) => {
      if (activo) {
        setMetricas(data)
        setCargando(false)
      }
    })

    return () => {
      activo = false
    }
  }, [rango])

  const maxHora = metricas
    ? Math.max(...metricas.distribucionHoraria.map((h) => h.cantidad), 1)
    : 1

  return (
    <div className="admin-analytics-wrapper animate-fade-in">
      {/* Selector de Rango Temporal */}
      <div className="admin-analytics-toolbar">
        <h2 className="admin-analytics-heading">📊 Métricas y Rendimiento Clínico</h2>
        <div className="admin-analytics-filters">
          <button
            onClick={() => setRango('hoy')}
            className={`admin-filter-btn ${rango === 'hoy' ? 'admin-filter-btn-active' : ''}`}
          >
            Hoy
          </button>
          <button
            onClick={() => setRango('semana')}
            className={`admin-filter-btn ${rango === 'semana' ? 'admin-filter-btn-active' : ''}`}
          >
            Últimos 7 días
          </button>
          <button
            onClick={() => setRango('mes')}
            className={`admin-filter-btn ${rango === 'mes' ? 'admin-filter-btn-active' : ''}`}
          >
            Último mes
          </button>
          <button
            onClick={cargarDatos}
            className="admin-filter-btn-refresh"
            title="Refrescar métricas"
          >
            🔄
          </button>
        </div>
      </div>

      {cargando ? (
        <LoadingSpinner texto="Calculando estadísticas clínicas..." />
      ) : !metricas ? (
        <p style={{ textAlign: 'center', color: '#94a3b8' }}>
          No se pudieron cargar los datos estadísticos.
        </p>
      ) : (
        <>
          {/* Rejilla de KPI Cards Principales */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">👥</div>
              <div className="admin-kpi-value">{metricas.totalTurnos}</div>
              <div className="admin-kpi-label">Total Pacientes</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">⏳</div>
              <div className="admin-kpi-value" style={{ color: '#38bdf8' }}>
                {metricas.enEspera}
              </div>
              <div className="admin-kpi-label">En Espera Ahora</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">✅</div>
              <div className="admin-kpi-value" style={{ color: '#34d399' }}>
                {metricas.llamadosOAtendidos}
              </div>
              <div className="admin-kpi-label">Atendidos / Llamados</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">⏱️</div>
              <div className="admin-kpi-value" style={{ color: '#fbbf24' }}>
                {metricas.tiempoMedioEsperaMin} <span style={{ fontSize: '1.2rem' }}>min</span>
              </div>
              <div className="admin-kpi-label">Tiempo Medio de Espera</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">📈</div>
              <div className="admin-kpi-value" style={{ color: '#a78bfa' }}>
                {metricas.tasaAtencion}%
              </div>
              <div className="admin-kpi-label">Tasa de Atención</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-icon">❌</div>
              <div className="admin-kpi-value" style={{ color: '#f87171' }}>
                {metricas.descartados}
              </div>
              <div className="admin-kpi-label">Descartados</div>
            </div>
          </div>

          {/* Gráfico de Afluencia por Horas */}
          <div className="admin-chart-card">
            <h3 className="admin-section-subtitle">⏰ Afluencia de Pacientes por Hora</h3>
            <div className="admin-hourly-chart">
              {metricas.distribucionHoraria.map((item) => {
                const alturaPorcentaje =
                  item.cantidad > 0 ? Math.max(12, (item.cantidad / maxHora) * 100) : 4

                return (
                  <div key={item.hora} className="admin-chart-bar-col">
                    <div className="admin-chart-bar-count">
                      {item.cantidad > 0 ? item.cantidad : ''}
                    </div>
                    <div className="admin-chart-bar-track">
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          height: `${alturaPorcentaje}%`,
                          backgroundColor: item.cantidad > 0 ? '#38bdf8' : '#334155',
                        }}
                      />
                    </div>
                    <div className="admin-chart-bar-label">{item.hora}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Desglose por Consulta Médica */}
          <div className="admin-rooms-breakdown-card">
            <h3 className="admin-section-subtitle">🩺 Rendimiento por Sala de Consulta</h3>
            <div className="admin-table-container">
              <table className="admin-analytics-table">
                <thead>
                  <tr>
                    <th>Consulta Médica</th>
                    <th style={{ textAlign: 'center' }}>Total Pacientes</th>
                    <th style={{ textAlign: 'center' }}>Atendidos</th>
                    <th style={{ textAlign: 'center' }}>En Espera</th>
                    <th style={{ textAlign: 'center' }}>Descartados</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.desgloseSalas.map((sala) => (
                    <tr key={sala.id}>
                      <td style={{ fontWeight: '600', color: '#f8fafc' }}>{sala.nombre}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sala.total}</td>
                      <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 'bold' }}>
                        {sala.atendidos}
                      </td>
                      <td style={{ textAlign: 'center', color: '#38bdf8', fontWeight: 'bold' }}>
                        {sala.espera}
                      </td>
                      <td style={{ textAlign: 'center', color: '#f87171' }}>
                        {sala.descartados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
