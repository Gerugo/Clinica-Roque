import { useState, useEffect, useRef } from 'react'
import {
  DURACION_OVERLAY_PANTALLA_MS,
  TIEMPO_AUTO_CIERRE_CONSULTA_MS,
} from '../../utils/constants.js'
import { useAudioChime } from '../../hooks/useAudioChime.js'
import { useRealtimeSubscription } from '../../hooks/useRealtime.js'
import { obtenerSalasActivas } from '../../services/rooms.js'
import { voiceService } from '../../services/voice.js'
import { supabase } from '../../services/supabase.js'
import { AudioPermissionModal } from './AudioPermissionModal.jsx'
import { RoomGrid } from './RoomGrid.jsx'
import { TicketOverlay } from './TicketOverlay.jsx'
import '../../styles/pantalla.css'

export function WaitingScreen() {
  const [turnosPorSala, setTurnosPorSala] = useState({})
  const [timestampPorSala, setTimestampPorSala] = useState({})
  const [salas, setSalas] = useState([])
  const [audioHabilitado, setAudioHabilitado] = useState(false)
  const [llamadaActiva, setLlamadaActiva] = useState(null)

  const temporizadorRef = useRef(null)
  const voiceTimeoutRef = useRef(null)
  const salasRef = useRef(salas)

  useEffect(() => {
    salasRef.current = salas
  }, [salas])

  const { reproducirChimePantalla, unlockAudio } = useAudioChime()

  // 1. Cargar salas y últimos turnos llamados (respetando el seguro de 30 min)
  useEffect(() => {
    let activo = true

    async function cargarInicial() {
      const { data: colasData, error } = await obtenerSalasActivas()
      if (error || !colasData.length || !activo) return

      setSalas(colasData)

      const salaIds = colasData.map((s) => s.id)
      const { data: turnosLlamados } = await supabase
        .from('turnos')
        .select('id, cola_id, numero, updated_at, created_at')
        .in('cola_id', salaIds)
        .eq('estado', 'llamado')
        .order('updated_at', { ascending: false })

      const turnosIniciales = {}
      const timestampsIniciales = {}
      const ahora = Date.now()
      const turnosParaAutoCerrar = []

      salaIds.forEach((id) => {
        turnosIniciales[id] = '-'
        timestampsIniciales[id] = 0
      })

      if (turnosLlamados) {
        turnosLlamados.forEach((t) => {
          const horaLlamada = new Date(t.updated_at || t.created_at).getTime()
          const transcurrido = ahora - horaLlamada

          if (transcurrido >= TIEMPO_AUTO_CIERRE_CONSULTA_MS) {
            turnosParaAutoCerrar.push(t.id)
          } else if (turnosIniciales[t.cola_id] === '-') {
            turnosIniciales[t.cola_id] = t.numero
            timestampsIniciales[t.cola_id] = horaLlamada
          }
        })
      }

      if (turnosParaAutoCerrar.length > 0) {
        supabase
          .from('turnos')
          .update({ estado: 'atendido' })
          .in('id', turnosParaAutoCerrar)
          .then(() => {})
      }

      if (activo) {
        setTurnosPorSala(turnosIniciales)
        setTimestampPorSala(timestampsIniciales)
      }
    }

    cargarInicial()

    return () => {
      activo = false
    }
  }, [])

  // 2. Intervalo periódico de seguro: limpiar en pantalla salas que lleven más de 30 min sin cerrar
  useEffect(() => {
    const intervaloSeguro = setInterval(() => {
      const ahora = Date.now()
      setTurnosPorSala((prevTurnos) => {
        let hayCambios = false
        const nuevosTurnos = { ...prevTurnos }

        Object.keys(timestampPorSala).forEach((colaId) => {
          const ts = timestampPorSala[colaId]
          if (ts > 0 && ahora - ts >= TIEMPO_AUTO_CIERRE_CONSULTA_MS) {
            if (nuevosTurnos[colaId] !== '-') {
              nuevosTurnos[colaId] = '-'
              hayCambios = true
            }
          }
        })

        return hayCambios ? nuevosTurnos : prevTurnos
      })
    }, 60000) // cada minuto

    return () => clearInterval(intervaloSeguro)
  }, [timestampPorSala])

  // 3. Suscripción Realtime a actualización de turnos
  useRealtimeSubscription({
    channelName: 'tv-pantalla-turnos',
    table: 'turnos',
    event: 'UPDATE',
    onPayload: (payload) => {
      const turnoActualizado = payload.new

      // Si el turno fue descartado o finalizado (atendido), liberar la sala en pantalla
      if (['descartado', 'atendido'].includes(turnoActualizado.estado)) {
        setTurnosPorSala((prev) => ({
          ...prev,
          [turnoActualizado.cola_id]: '-',
        }))
        setTimestampPorSala((prev) => ({
          ...prev,
          [turnoActualizado.cola_id]: 0,
        }))
        return
      }

      if (turnoActualizado.estado === 'llamado') {
        const ahora = Date.now()
        setTurnosPorSala((prev) => ({
          ...prev,
          [turnoActualizado.cola_id]: turnoActualizado.numero,
        }))
        setTimestampPorSala((prev) => ({
          ...prev,
          [turnoActualizado.cola_id]: ahora,
        }))

        // A. Reproducir sonido de campanilla (Chime)
        reproducirChimePantalla()

        // B. Anunciar por voz sintetizada en español tras terminar el sonido (550ms)
        const salaEncontrada = salasRef.current.find((s) => s.id === turnoActualizado.cola_id)
        if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current)
        voiceTimeoutRef.current = setTimeout(() => {
          voiceService.anunciarTurno(
            turnoActualizado.numero,
            salaEncontrada ? salaEncontrada.nombre : 'Consulta'
          )
        }, 550)

        // C. Mostrar overlay de turno llamado
        setLlamadaActiva({
          cola_id: turnoActualizado.cola_id,
          numero: turnoActualizado.numero,
        })

        if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
        temporizadorRef.current = setTimeout(() => {
          setLlamadaActiva(null)
        }, DURACION_OVERLAY_PANTALLA_MS)
      }
    },
  })

  // Limpieza de temporizadores
  useEffect(() => {
    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current)
    }
  }, [])

  const habilitarAudioYPantalla = () => {
    unlockAudio()
    setAudioHabilitado(true)
    reproducirChimePantalla()
  }

  const salaDetalle = llamadaActiva
    ? salas.find((s) => s.id === llamadaActiva.cola_id)
    : null

  return (
    <div className="pantalla-container">
      {/* Modal de desbloqueo de audio para Autoplay Policy */}
      {!audioHabilitado && (
        <AudioPermissionModal onActivar={habilitarAudioYPantalla} />
      )}

      {/* Overlay a pantalla completa de turno llamado */}
      <TicketOverlay
        llamadaActiva={llamadaActiva}
        salaNombre={salaDetalle ? salaDetalle.nombre : null}
      />

      {/* Encabezado */}
      <header className="pantalla-header">
        <p className="pantalla-header-title">Turnos Actuales</p>
      </header>

      {/* Grid Rejilla de Salas */}
      <RoomGrid salas={salas} turnosPorSala={turnosPorSala} />
    </div>
  )
}
