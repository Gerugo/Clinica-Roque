import { supabase } from './supabase.js'

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
 * Resuelve el problema de consultas N+1
 */
export async function obtenerEstadoCompletoSalas() {
  const { data: colasData, error: colasError } = await obtenerSalasActivas()
  if (colasError || !colasData.length) {
    return { colas: [], turnosActuales: {}, esperaPorSala: {} }
  }

  // Traer los turnos activos en una sola consulta por tipo
  const salaIds = colasData.map(s => s.id)

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

  // Inicializar todas las salas en 0 / null
  salaIds.forEach(id => {
    turnosActuales[id] = null
    esperaPorSala[id] = 0
  })

  // Asignar el último turno llamado por sala
  if (llamadosRes.data) {
    llamadosRes.data.forEach(turno => {
      if (!turnosActuales[turno.cola_id]) {
        turnosActuales[turno.cola_id] = turno
      }
    })
  }

  // Contar pacientes en espera por sala
  if (esperaRes.data) {
    esperaRes.data.forEach(t => {
      esperaPorSala[t.cola_id] = (esperaPorSala[t.cola_id] || 0) + 1
    })
  }

  return {
    colas: colasData,
    turnosActuales,
    esperaPorSala,
  }
}
