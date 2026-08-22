import { useEffect, useRef } from 'react'
import { supabase } from '../services/supabase.js'

/**
 * Hook para suscribirse de forma segura a eventos Realtime de Postgres en Supabase
 *
 * @param {string} channelName Nombre único del canal
 * @param {string} table Nombre de la tabla ('turnos', 'colas')
 * @param {string} event Evento a escuchar ('*' | 'INSERT' | 'UPDATE' | 'DELETE')
 * @param {Function} onPayload Callback que recibe el payload
 * @param {string|null} filter Filtro opcional de Postgres (ej: 'cola_id=eq.1')
 */
export function useRealtimeSubscription({
  channelName,
  table,
  event = '*',
  onPayload,
  filter = null,
  enabled = true,
}) {
  const callbackRef = useRef(onPayload)

  useEffect(() => {
    callbackRef.current = onPayload
  }, [onPayload])

  useEffect(() => {
    if (!enabled) return

    const config = {
      event,
      schema: 'public',
      table,
    }

    if (filter) {
      config.filter = filter
    }

    const channel = supabase
      .channel(`${channelName}-${Date.now()}`)
      .on('postgres_changes', config, (payload) => {
        if (callbackRef.current) {
          callbackRef.current(payload)
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Realtime] Error en canal ${channelName}`)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, enabled])
}
