import { useState, useEffect, useCallback, useMemo } from 'react'
import { STORAGE_KEYS } from '../../utils/constants.js'
import { useAudioChime } from '../../hooks/useAudioChime.js'
import { useWakeLock } from '../../hooks/useWakeLock.js'
import { useRealtimeSubscription } from '../../hooks/useRealtime.js'
import { useQueueEstimation } from '../../hooks/useQueueEstimation.js'
import { obtenerSalasActivas } from '../../services/rooms.js'
import {
  solicitarTurnoPaciente,
  recuperarTurnoPorCodigo,
} from '../../services/tickets.js'
import { registrarSuscripcionPush } from '../../services/push.js'
import { supabase } from '../../services/supabase.js'
import { CalledAlertModal } from './CalledAlertModal.jsx'
import { QueueStatus } from './QueueStatus.jsx'
import { TicketSelector } from './TicketSelector.jsx'
import { TicketRecoveryModal } from './TicketRecoveryModal.jsx'
import { InstallBanner } from './InstallBanner.jsx'
import '../../styles/recepcion.css'

export function PatientView() {
  const [salas, setSalas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false)
  const [buscandoTurno, setBuscandoTurno] = useState(false)
  const [errorRecuperar, setErrorRecuperar] = useState('')

  // 1. Estado de turnos del paciente inicializado desde LocalStorage
  const [misTurnos, setMisTurnos] = useState(() => {
    try {
      const guardados = localStorage.getItem(STORAGE_KEYS.TURNOS_PACIENTE)
      return guardados ? JSON.parse(guardados) : []
    } catch {
      return []
    }
  })

  const { reproducirChimeMovil } = useAudioChime()

  // 2. Filtrar turnos activos en espera
  const turnosEnEspera = useMemo(
    () => misTurnos.filter((t) => t.estado === 'espera'),
    [misTurnos]
  )

  const turnoLlamado = useMemo(
    () => misTurnos.find((t) => t.estado === 'llamado'),
    [misTurnos]
  )

  // 3. Activar WakeLock mientras haya turnos en espera
  useWakeLock(turnosEnEspera.length > 0)

  // 4. Hook de estimación de cola (posiciones y tiempo estimado)
  const { posiciones, etasMins, recalcularMetricas } = useQueueEstimation(turnosEnEspera)

  // 5. Sincronización contra la base de datos
  const sincronizarTurnos = useCallback(async () => {
    const { data: salasData } = await obtenerSalasActivas()
    if (salasData) setSalas(salasData)

    const guardados = localStorage.getItem(STORAGE_KEYS.TURNOS_PACIENTE)
    const turnosLocales = guardados ? JSON.parse(guardados) : []

    if (turnosLocales.length > 0) {
      const ids = turnosLocales.map((t) => t.id)
      const { data: turnosBD } = await supabase
        .from('turnos')
        .select('id, estado')
        .in('id', ids)

      if (turnosBD) {
        const turnosValidos = turnosLocales
          .filter((t) => {
            const dbT = turnosBD.find((db) => db.id === t.id)
            return dbT && (dbT.estado === 'espera' || dbT.estado === 'llamado')
          })
          .map((t) => {
            const dbT = turnosBD.find((db) => db.id === t.id)
            return { ...t, estado: dbT.estado }
          })

        setMisTurnos(turnosValidos)
      }
    }

    recalcularMetricas()
  }, [recalcularMetricas])

  useEffect(() => {
    let activo = true

    async function init() {
      const { data: salasData } = await obtenerSalasActivas()
      if (activo && salasData) setSalas(salasData)

      const guardados = localStorage.getItem(STORAGE_KEYS.TURNOS_PACIENTE)
      const turnosLocales = guardados ? JSON.parse(guardados) : []

      if (turnosLocales.length > 0) {
        const ids = turnosLocales.map((t) => t.id)
        const { data: turnosBD } = await supabase
          .from('turnos')
          .select('id, estado')
          .in('id', ids)

        if (turnosBD && activo) {
          const turnosValidos = turnosLocales
            .filter((t) => {
              const dbT = turnosBD.find((db) => db.id === t.id)
              return dbT && (dbT.estado === 'espera' || dbT.estado === 'llamado')
            })
            .map((t) => {
              const dbT = turnosBD.find((db) => db.id === t.id)
              return { ...t, estado: dbT.estado }
            })

          setMisTurnos(turnosValidos)
        }
      }
    }

    init()

    const manejarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        sincronizarTurnos()
      }
    }

    document.addEventListener('visibilitychange', manejarVisibilidad)
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', manejarVisibilidad)
    }
  }, [sincronizarTurnos])

  // 6. Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TURNOS_PACIENTE, JSON.stringify(misTurnos))
    } catch {
      // Ignorar fallo de cuota en storage
    }
  }, [misTurnos])

  // 7. Suscripción Realtime a actualización de turnos
  useRealtimeSubscription({
    channelName: 'paciente-turnos-realtime',
    table: 'turnos',
    event: 'UPDATE',
    onPayload: (payload) => {
      const turnoActualizado = payload.new

      // Recalcular métricas si cambia el flujo de la cola
      if (['llamado', 'descartado', 'atendido'].includes(turnoActualizado.estado)) {
        recalcularMetricas()
      }

      setMisTurnos((prevTurnos) => {
        const index = prevTurnos.findIndex((t) => t.id === turnoActualizado.id)
        if (index === -1) return prevTurnos

        // Si fue descartado o atendido, remover de la lista
        if (['descartado', 'atendido'].includes(turnoActualizado.estado)) {
          return prevTurnos.filter((t) => t.id !== turnoActualizado.id)
        }

        const nuevosTurnos = [...prevTurnos]
        // Si acaba de ser llamado, vibrar y reproducir sonido
        if (
          turnoActualizado.estado === 'llamado' &&
          prevTurnos[index].estado !== 'llamado'
        ) {
          if ('vibrate' in navigator) {
            navigator.vibrate([300, 100, 300, 100, 300])
          }
          reproducirChimeMovil()
        }

        nuevosTurnos[index] = {
          ...nuevosTurnos[index],
          estado: turnoActualizado.estado,
        }
        return nuevosTurnos
      })
    },
  })

  // 8. Solicitar un nuevo turno
  const handlePedirTurno = async (sala) => {
    if (misTurnos.some((t) => t.cola_id === sala.id && t.estado === 'espera')) {
      alert(`Ya tienes un turno activo para ${sala.nombre}`)
      return
    }

    setCargando(true)

    // Solicitar permiso de push
    const { datos: datosPush, motivo: motivoSinPush } = await registrarSuscripcionPush()

    // Crear el turno en base de datos
    const { data: turnoCreado, error } = await solicitarTurnoPaciente(sala.id, datosPush)

    if (turnoCreado && !error) {
      const nuevoTurno = {
        id: turnoCreado.id,
        numero: turnoCreado.numero,
        sala: sala.nombre,
        cola_id: sala.id,
        estado: 'espera',
      }

      setMisTurnos((prev) => [...prev, nuevoTurno])
      recalcularMetricas()

      if (!datosPush) {
        const mensajes = {
          denegado:
            'Tienes las notificaciones bloqueadas. Te recomendamos mantener esta pantalla abierta para seguir tu turno en directo.',
          'no-soportado':
            'Tu navegador no admite notificaciones push. Mantén esta pantalla abierta para ver cuándo te toca.',
          'no-concedido':
            'No podremos enviarte aviso por notificación. Mantén esta pantalla abierta para ver tu posición.',
          error:
            'No se pudo activar la notificación push. Mantén esta pantalla abierta para ver tu posición.',
        }
        alert(
          `Turno ${turnoCreado.numero} solicitado.\n\n⚠️ ${mensajes[motivoSinPush] || mensajes.error}`
        )
      }
    } else {
      alert('Error al solicitar el turno. Por favor, inténtelo de nuevo.')
    }

    setCargando(false)
  }

  // 9. Recuperar turno por código
  const handleRecuperarTurno = async (salaId, codigo) => {
    setErrorRecuperar('')
    setBuscandoTurno(true)

    const { data: turnoEncontrado, error } = await recuperarTurnoPorCodigo(salaId, codigo)
    setBuscandoTurno(false)

    if (error || !turnoEncontrado) {
      setErrorRecuperar(
        error?.message || 'No se encontró ningún turno activo con ese código.'
      )
      return
    }

    if (misTurnos.some((t) => t.id === turnoEncontrado.id)) {
      setErrorRecuperar('Ese turno ya se encuentra en tu pantalla.')
      return
    }

    const salaInfo = salas.find((s) => s.id === turnoEncontrado.cola_id)
    const nuevoTurno = {
      id: turnoEncontrado.id,
      numero: turnoEncontrado.numero,
      sala: salaInfo ? salaInfo.nombre : 'Consulta',
      cola_id: turnoEncontrado.cola_id,
      estado: turnoEncontrado.estado,
    }

    setMisTurnos((prev) => [...prev, nuevoTurno])
    recalcularMetricas()
    setMostrarRecuperar(false)
  }

  // Si el paciente ha sido llamado, mostrar pantalla prioritaria verde
  if (turnoLlamado) {
    return <CalledAlertModal turno={turnoLlamado} />
  }

  return (
    <div className="recepcion-container">
      {/* Encabezado */}
      <header className="recepcion-header">
        <img
          src="/pwa-192x192.png"
          alt="Clínica Roque"
          className="recepcion-logo"
        />
        <h1 className="recepcion-title">Clínica Roque</h1>
        <p className="recepcion-subtitle">Gestión de Turnos y Sala de Espera</p>
      </header>

      {/* Banner de instalación PWA */}
      <InstallBanner />

      {/* Estado y métricas de turnos en espera */}
      <QueueStatus
        turnosEnEspera={turnosEnEspera}
        posiciones={posiciones}
        etasMins={etasMins}
      />

      {/* Selector de salas / consultas */}
      <TicketSelector
        salas={salas}
        misTurnos={misTurnos}
        cargando={cargando}
        onPedirTurno={handlePedirTurno}
      />

      {/* Sección para recuperar turno por código */}
      <div className="recepcion-recovery-section">
        {!mostrarRecuperar ? (
          <button
            onClick={() => setMostrarRecuperar(true)}
            className="recepcion-recovery-toggle-btn"
          >
            ¿Ya tenías un turno y no lo ves? Recupéralo por código
          </button>
        ) : (
          <TicketRecoveryModal
            salas={salas}
            buscando={buscandoTurno}
            error={errorRecuperar}
            onRecuperar={handleRecuperarTurno}
            onCerrar={() => {
              setMostrarRecuperar(false)
              setErrorRecuperar('')
            }}
          />
        )}
      </div>
    </div>
  )
}
