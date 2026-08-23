import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { useRealtimeSubscription } from '../../hooks/useRealtime.js'
import {
  obtenerEstadoCompletoSalas,
  crearSala,
  desactivarSala,
} from '../../services/rooms.js'
import {
  llamarSiguientePaciente,
  finalizarConsultaPaciente,
  reLlamarPaciente,
  descartarPaciente,
  crearTurnoManualConImpresion,
} from '../../services/tickets.js'
import { LoginForm } from './LoginForm.jsx'
import { RoomCard } from './RoomCard.jsx'
import { AnalyticsDashboard } from './AnalyticsDashboard.jsx'
import '../../styles/admin.css'

function StethoscopeIcon({ color = 'currentColor' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

function BarChartTabIcon({ color = 'currentColor' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

export function AdminDashboard() {
  const { autenticado, cargando: cargandoAuth, errorAuth, procesandoLogin, login, logout } = useAuth()

  const [tabActiva, setTabActiva] = useState('salas') // 'salas' | 'analytics'
  const [colas, setColas] = useState([])
  const [turnoActual, setTurnoActual] = useState({})
  const [esperaPorSala, setEsperaPorSala] = useState({})
  const [nuevaConsulta, setNuevaConsulta] = useState('')
  const [creandoCola, setCreandoCola] = useState(false)
  const [cargandoSalaId, setCargandoSalaId] = useState(null)

  // 1. Cargar datos iniciales de todas las salas
  const cargarDatos = useCallback(async () => {
    if (!autenticado) return
    const { colas: colasData, turnosActuales, esperaPorSala: esperas } =
      await obtenerEstadoCompletoSalas()
    setColas(colasData)
    setTurnoActual(turnosActuales)
    setEsperaPorSala(esperas)
  }, [autenticado])

  useEffect(() => {
    let activo = true

    if (autenticado) {
      obtenerEstadoCompletoSalas().then(({ colas: colasData, turnosActuales, esperaPorSala: esperas }) => {
        if (activo) {
          setColas(colasData)
          setTurnoActual(turnosActuales)
          setEsperaPorSala(esperas)
        }
      })
    }

    return () => {
      activo = false
    }
  }, [autenticado])

  // 2. Suscripción Realtime completa (INSERT, UPDATE, DELETE)
  useRealtimeSubscription({
    channelName: 'admin-turnos-realtime',
    table: 'turnos',
    event: '*',
    enabled: autenticado,
    onPayload: (payload) => {
      const { eventType, new: nuevo, old: anterior } = payload

      if (eventType === 'INSERT') {
        if (nuevo.estado === 'espera') {
          setEsperaPorSala((prev) => ({
            ...prev,
            [nuevo.cola_id]: (prev[nuevo.cola_id] || 0) + 1,
          }))
        }
      } else if (eventType === 'UPDATE') {
        if (nuevo.estado === 'llamado') {
          setTurnoActual((prev) => ({ ...prev, [nuevo.cola_id]: nuevo }))
          if (anterior?.estado === 'espera' || !anterior?.estado) {
            setEsperaPorSala((prev) => ({
              ...prev,
              [nuevo.cola_id]: Math.max(0, (prev[nuevo.cola_id] || 1) - 1),
            }))
          }
        } else if (nuevo.estado === 'descartado' || nuevo.estado === 'atendido') {
          setTurnoActual((prev) => {
            if (prev[nuevo.cola_id]?.id === nuevo.id) {
              return { ...prev, [nuevo.cola_id]: null }
            }
            return prev
          })
          if (anterior?.estado === 'espera') {
            setEsperaPorSala((prev) => ({
              ...prev,
              [nuevo.cola_id]: Math.max(0, (prev[nuevo.cola_id] || 1) - 1),
            }))
          }
        }
      } else if (eventType === 'DELETE') {
        cargarDatos()
      }
    },
  })

  // 3. Acciones de Administración
  const handleCrearSala = async (e) => {
    e.preventDefault()
    if (!nuevaConsulta.trim() || creandoCola) return

    setCreandoCola(true)
    const { data, error } = await crearSala(nuevaConsulta)

    if (data && !error) {
      setColas((prev) => [...prev, data])
      setTurnoActual((prev) => ({ ...prev, [data.id]: null }))
      setEsperaPorSala((prev) => ({ ...prev, [data.id]: 0 }))
      setNuevaConsulta('')
    } else {
      alert('Error al crear la sala de consulta.')
    }
    setCreandoCola(false)
  }

  const handleEliminarSala = async (salaId, nombreSala) => {
    const confirmacion = window.confirm(`¿Estás seguro de eliminar "${nombreSala}"?`)
    if (!confirmacion) return

    const { exito } = await desactivarSala(salaId)
    if (exito) {
      setColas((prev) => prev.filter((c) => c.id !== salaId))
    } else {
      alert('Error al eliminar la sala.')
    }
  }

  const handleLlamarSiguiente = async (salaId, nombreSala) => {
    setCargandoSalaId(salaId)
    const resultado = await llamarSiguientePaciente(salaId, nombreSala)

    if (!resultado.exito) {
      alert(resultado.mensaje || 'Error al llamar al siguiente paciente.')
    } else if (resultado.turnoLlamado) {
      setTurnoActual((prev) => ({ ...prev, [salaId]: resultado.turnoLlamado }))
      setEsperaPorSala((prev) => ({
        ...prev,
        [salaId]: Math.max(0, (prev[salaId] || 1) - 1),
      }))
    }
    setCargandoSalaId(null)
  }

  const handleFinalizarConsulta = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return

    setCargandoSalaId(salaId)
    const { exito } = await finalizarConsultaPaciente(turno.id)
    if (exito) {
      setTurnoActual((prev) => ({ ...prev, [salaId]: null }))
    } else {
      alert('Error al finalizar la consulta.')
    }
    setCargandoSalaId(null)
  }

  const handleReLlamar = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return

    const sala = colas.find((c) => c.id === salaId)
    setCargandoSalaId(salaId)
    await reLlamarPaciente(turno, sala ? sala.nombre : '')
    setCargandoSalaId(null)
  }

  const handleDescartar = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return

    const confirmacion = window.confirm(`¿Descartar el turno ${turno.numero}?`)
    if (!confirmacion) return

    setCargandoSalaId(salaId)
    const { exito } = await descartarPaciente(turno.id)
    if (exito) {
      setTurnoActual((prev) => ({ ...prev, [salaId]: null }))
    }
    setCargandoSalaId(null)
  }

  const handleImprimirPapel = async (salaId, nombreSala) => {
    setCargandoSalaId(salaId)
    const { exito, error } = await crearTurnoManualConImpresion(salaId, nombreSala)
    if (!exito) {
      alert(error?.message || 'Error al generar o imprimir el ticket en papel.')
    }
    setCargandoSalaId(null)
  }

  if (cargandoAuth) {
    return (
      <div className="admin-login-wrapper">
        <p style={{ color: '#94a3b8' }}>Verificando sesión médica...</p>
      </div>
    )
  }

  if (!autenticado) {
    return <LoginForm onLogin={login} cargando={procesandoLogin} error={errorAuth} />
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button onClick={logout} className="admin-logout-btn">
          Cerrar Sesión
        </button>

        <h1 className="admin-header-title">Panel de Administración</h1>
        <p className="admin-header-sub">Gestión avanzada de salas y métricas clínicas</p>
      </header>

      {/* Navegación por Pestañas */}
      <nav className="admin-tab-nav" aria-label="Secciones del panel">
        <button
          onClick={() => setTabActiva('salas')}
          className={`admin-tab-btn ${tabActiva === 'salas' ? 'admin-tab-btn-active' : ''}`}
        >
          <StethoscopeIcon />
          Salas y Turnos
        </button>
        <button
          onClick={() => setTabActiva('analytics')}
          className={`admin-tab-btn ${tabActiva === 'analytics' ? 'admin-tab-btn-active' : ''}`}
        >
          <BarChartTabIcon />
          Analítica y KPIs
        </button>
      </nav>

      {/* Pestaña 1: Gestión de Salas */}
      {tabActiva === 'salas' && (
        <>
          {/* Formulario Añadir Sala */}
          <form onSubmit={handleCrearSala} className="admin-add-room-bar">
            <input
              type="text"
              placeholder="Nombre de la nueva sala (Ej: Consulta 3 - Traumatología)..."
              value={nuevaConsulta}
              onChange={(e) => setNuevaConsulta(e.target.value)}
              className="admin-input-text"
            />
            <button
              type="submit"
              disabled={creandoCola || !nuevaConsulta.trim()}
              className="admin-btn-primary"
            >
              {creandoCola ? 'Creando...' : '+ Añadir Sala'}
            </button>
          </form>

          {/* Grid de Salas */}
          <div className="admin-rooms-grid">
            {colas.map((sala) => (
              <RoomCard
                key={sala.id}
                sala={sala}
                turnoActual={turnoActual[sala.id]}
                enEspera={esperaPorSala[sala.id] || 0}
                estaCargando={cargandoSalaId === sala.id}
                onLlamarSiguiente={handleLlamarSiguiente}
                onFinalizarConsulta={handleFinalizarConsulta}
                onReLlamar={handleReLlamar}
                onDescartar={handleDescartar}
                onImprimirPapel={handleImprimirPapel}
                onEliminarSala={handleEliminarSala}
              />
            ))}
          </div>
        </>
      )}

      {/* Pestaña 2: Analítica y Estadísticas */}
      {tabActiva === 'analytics' && <AnalyticsDashboard />}
    </div>
  )
}
