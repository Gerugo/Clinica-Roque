import { supabase } from './supabase.js'
import { TIEMPO_AUTO_CIERRE_CONSULTA_MS } from '../utils/constants.js'

/**
 * Obtiene todas las salas/colas de consulta activas
 */
export async function obtenerSalasActivas() {
  const { data, error } = await supabase
    .from('colas')
    .select('*')
    .eq('activa', true)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error al obtener salas activas:', error)
    return { data: [], error }
  }

  return { data: data || [], error: null }
}

/**
 * Crea una nueva sala de consulta
 */
export async function crearSala(nombre) {
  const nombreLimpio = nombre ? nombre.trim() : ''
  if (!nombreLimpio) return { data: null, error: new Error('Nombre de sala inválido') }

  const { data, error } = await supabase
    .from('colas')
    .insert([{ nombre: nombreLimpio, activa: true }])
    .select()

  if (error) {
    console.error('Error al crear sala:', error)
    return { data: null, error }
  }

  return { data: data && data.length > 0 ? data[0] : null, error: null }
}

/**
 * Desactiva (soft-delete) una sala de consulta
 */
export async function desactivarSala(salaId) {
  const { error } = await supabase
    .from('colas')
    .update({ activa: false })
    .eq('id', salaId)

  if (error) {
    console.error('Error al desactivar sala:', error)
    return { exito: false, error }
  }

  return { exito: true, error: null }
}

/**
 * Carga el estado completo de todas las salas para el panel de administración
 * Incluye seguro de cierre automático para consultas con más de 30 minutos sin cerrar
 */
export async function obtenerEstadoCompletoSalas() {
  const { data: colasData, error: colasError } = await obtenerSalasActivas()
  if (colasError || !colasData.length) {
    return { colas: [], turnosActuales: {}, esperaPorSala: {} }
  }

  const salaIds = colasData.map((s) => s.id)

  const [llamadosRes, esperaRes] = await Promise.all([
    supabase
      .from('turnos')
      .select('*')
      .in('cola_id', salaIds)
      .eq('estado', 'llamado')
      .order('updated_at', { ascending: false }),
    supabase
      .from('turnos')
      .select('cola_id')
      .in('cola_id', salaIds)
      .eq('estado', 'espera'),
  ])

  const turnosActuales = {}
  const esperaPorSala = {}
  const ahora = Date.now()
  const turnosParaAutoCerrar = []

  // Inicializar todas las salas en 0 / null
  salaIds.forEach((id) => {
    turnosActuales[id] = null
    esperaPorSala[id] = 0
  })

  // Asignar el último turno llamado por sala con verificación de seguro de 30 min
  if (llamadosRes.data) {
    llamadosRes.data.forEach((turno) => {
      const horaLlamada = new Date(turno.updated_at || turno.created_at).getTime()
      const transcurrido = ahora - horaLlamada

      if (transcurrido >= TIEMPO_AUTO_CIERRE_CONSULTA_MS) {
        // Excedió los 30 minutos: se auto-cierra
        turnosParaAutoCerrar.push(turno.id)
      } else if (!turnosActuales[turno.cola_id]) {
        turnosActuales[turno.cola_id] = turno
      }
    })
  }

  // Contar pacientes en espera por sala
  if (esperaRes.data) {
    esperaRes.data.forEach((item) => {
      esperaPorSala[item.cola_id] = (esperaPorSala[item.cola_id] || 0) + 1
    })
  }

  // Ejecutar el auto-cierre en Supabase en segundo plano
  if (turnosParaAutoCerrar.length > 0) {
    supabase
      .from('turnos')
      .update({ estado: 'atendido' })
      .in('id', turnosParaAutoCerrar)
      .then(() => {
        console.log(`[Auto-Cierre] ${turnosParaAutoCerrar.length} consultas cerradas automáticamente (>30m).`)
      })
  }

  return {
    colas: colasData,
    turnosActuales,
    esperaPorSala,
  }
}
