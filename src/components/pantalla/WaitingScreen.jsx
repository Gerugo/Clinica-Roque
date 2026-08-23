import { useState, useEffect, useRef } from 'react'
import { DURACION_OVERLAY_PANTALLA_MS } from '../../utils/constants.js'
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

  // 1. Cargar salas y últimos turnos llamados
  useEffect(() => {
    let activo = true

    async function cargarInicial() {
      const { data: colasData, error } = await obtenerSalasActivas()
      if (error || !colasData.length || !activo) return

      setSalas(colasData)

      const salaIds = colasData.map((s) => s.id)
      const { data: turnosLlamados } = await supabase
        .from('turnos')
        .select('cola_id, numero')
        .in('cola_id', salaIds)
        .eq('estado', 'llamado')
        .order('updated_at', { ascending: false })

      const turnosIniciales = {}
      salaIds.forEach((id) => {
        turnosIniciales[id] = '-'
      })

      if (turnosLlamados) {
        turnosLlamados.forEach((t) => {
          if (turnosIniciales[t.cola_id] === '-') {
            turnosIniciales[t.cola_id] = t.numero
          }
        })
      }

      if (activo) {
        setTurnosPorSala(turnosIniciales)
      }
    }

    cargarInicial()

    return () => {
      activo = false
    }
  }, [])

  // 2. Suscripción Realtime a actualización de turnos
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
        return
      }

      if (turnoActualizado.estado === 'llamado') {
        setTurnosPorSala((prev) => ({
          ...prev,
          [turnoActualizado.cola_id]: turnoActualizado.numero,
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
