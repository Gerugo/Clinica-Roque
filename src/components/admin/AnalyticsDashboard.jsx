import { useState, useEffect, useCallback } from 'react'
import { obtenerMetricasClinica } from '../../services/analytics.js'
import { LoadingSpinner } from '../common/LoadingSpinner.jsx'

// Componentes de iconos vectoriales limpios (SVG)
function UsersIcon({ className, color = '#94a3b8' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function HourglassIcon({ className, color = '#38bdf8' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  )
}

function CheckCircleIcon({ className, color = '#34d399' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function TimerIcon({ className, color = '#fbbf24' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TrendingUpIcon({ className, color = '#a78bfa' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function XCircleIcon({ className, color = '#f87171' }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function RefreshIcon({ className, color = '#94a3b8' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function BarChartIcon({ className, color = '#38bdf8' }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function ActivityIcon({ className, color = '#38bdf8' }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="admin-icon-badge admin-icon-badge-sky">
            <BarChartIcon color="#38bdf8" />
          </div>
          <h2 className="admin-analytics-heading">Métricas y Rendimiento Clínico</h2>
        </div>

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
            aria-label="Refrescar métricas"
          >
            <RefreshIcon color="#94a3b8" />
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
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-slate">
                  <UsersIcon color="#94a3b8" />
                </div>
                <span className="admin-kpi-label">Total Pacientes</span>
              </div>
              <div className="admin-kpi-value">{metricas.totalTurnos}</div>
              <div className="admin-kpi-subtext">Registrados en el periodo</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-sky">
                  <HourglassIcon color="#38bdf8" />
                </div>
                <span className="admin-kpi-label">En Espera</span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#38bdf8' }}>
                {metricas.enEspera}
              </div>
              <div className="admin-kpi-subtext">Esperando turno ahora</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-emerald">
                  <CheckCircleIcon color="#34d399" />
                </div>
                <span className="admin-kpi-label">Atendidos</span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#34d399' }}>
                {metricas.llamadosOAtendidos}
              </div>
              <div className="admin-kpi-subtext">Llamados a consulta</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-amber">
                  <TimerIcon color="#fbbf24" />
                </div>
                <span className="admin-kpi-label">Tiempo Medio</span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#fbbf24' }}>
                {metricas.tiempoMedioEsperaMin} <span style={{ fontSize: '1.1rem', fontWeight: 'normal' }}>min</span>
              </div>
              <div className="admin-kpi-subtext">Espera hasta llamada</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-purple">
                  <TrendingUpIcon color="#a78bfa" />
                </div>
                <span className="admin-kpi-label">Efectividad</span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#a78bfa' }}>
                {metricas.tasaAtencion}%
              </div>
              <div className="admin-kpi-subtext">Tasa de atención</div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-header">
                <div className="admin-icon-badge admin-icon-badge-rose">
                  <XCircleIcon color="#f87171" />
                </div>
                <span className="admin-kpi-label">Descartados</span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#f87171' }}>
                {metricas.descartados}
              </div>
              <div className="admin-kpi-subtext">Turnos no asistidos</div>
            </div>
          </div>

          {/* Gráfico de Afluencia por Horas */}
          <div className="admin-chart-card">
            <div className="admin-section-header">
              <div className="admin-icon-badge admin-icon-badge-sky">
                <TimerIcon color="#38bdf8" />
              </div>
              <h3 className="admin-section-subtitle">Afluencia de Pacientes por Franja Horaria</h3>
            </div>

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
            <div className="admin-section-header">
              <div className="admin-icon-badge admin-icon-badge-sky">
                <ActivityIcon color="#38bdf8" />
              </div>
              <h3 className="admin-section-subtitle">Rendimiento por Sala de Consulta</h3>
            </div>

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
