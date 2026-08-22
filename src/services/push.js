import { PUBLIC_VAPID_KEY } from '../utils/constants.js'
import { urlBase64ToUint8Array } from '../utils/deviceDetection.js'
import { supabase } from './supabase.js'

/**
 * Obtiene o crea una suscripción Web Push para el dispositivo del paciente
 */
export async function registrarSuscripcionPush() {
  if (typeof window === 'undefined') return { datos: null, motivo: 'no-soportado' }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { datos: null, motivo: 'no-soportado' }
  }

  try {
    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') {
      return { datos: null, motivo: permiso === 'denied' ? 'denegado' : 'no-concedido' }
    }

    // Registrar o reutilizar el service worker
    const registro = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const suscripcionExistente = await registro.pushManager.getSubscription()
    if (suscripcionExistente) {
      await suscripcionExistente.unsubscribe()
    }

    const nuevaSuscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    })

    return { datos: nuevaSuscripcion.toJSON(), motivo: null }
  } catch (error) {
    console.error('Error al registrar Web Push:', error)
    return { datos: null, motivo: 'error' }
  }
}

/**
 * Envía una notificación push invocando la Supabase Edge Function 'enviar-alerta'
 */
export async function enviarAlertaPush({
  suscripcion,
  salaNombre,
  numeroTurno,
  tipoAlerta = 'llamado',
  turnoId,
}) {
  if (!suscripcion) return false

  try {
    const suscripcionObj =
      typeof suscripcion === 'string' ? JSON.parse(suscripcion) : suscripcion

    const { error } = await supabase.functions.invoke('enviar-alerta', {
      body: {
        suscripcion: suscripcionObj,
        sala: salaNombre,
        numero: numeroTurno,
        tipo: tipoAlerta,
        turnoId: turnoId,
      },
    })

    if (error) {
      console.warn('Edge function enviar-alerta retornó error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error al disparar alerta push:', error)
    return false
  }
}
