import { supabase } from './supabase.js'

/**
 * Servicio de métricas y analítica clínica
 */
export async function obtenerMetricasClinica(rango = 'hoy') {
  try {
    let fechaInicio = new Date()
    fechaInicio.setHours(0, 0, 0, 0)

    if (rango === 'semana') {
      fechaInicio.setDate(fechaInicio.getDate() - 7)
    } else if (rango === 'mes') {
      fechaInicio.setDate(fechaInicio.getDate() - 30)
    }

    const isoFecha = fechaInicio.toISOString()

    // 1. Obtener todos los turnos en el rango
    const { data: turnos, error: errorTurnos } = await supabase
      .from('turnos')
      .select('id, cola_id, numero, estado, created_at, updated_at')
      .gte('created_at', isoFecha)
      .order('created_at', { ascending: true })

    // 2. Obtener salas
    const { data: salas, error: errorSalas } = await supabase
      .from('colas')
      .select('id, nombre')

    if (errorTurnos || errorSalas) {
      console.error('Error al obtener datos de analytics:', errorTurnos || errorSalas)
      return null
    }

    const salasMap = {}
    if (salas) {
      salas.forEach((s) => {
        salasMap[s.id] = s.nombre
      })
    }

    const totalTurnos = turnos.length
    const enEspera = turnos.filter((t) => t.estado === 'espera').length
    const llamadosOAtendidos = turnos.filter(
      (t) => t.estado === 'llamado' || t.estado === 'atendido'
    ).length
    const descartados = turnos.filter((t) => t.estado === 'descartado').length

    // Tasa de completitud
    const tasaAtencion =
      totalTurnos > 0
        ? Math.round((llamadosOAtendidos / totalTurnos) * 100)
        : 0

    // Cálculo de tiempo medio de espera (desde created_at hasta updated_at cuando fue llamado)
    let sumaTiemposEsperaMin = 0
    let conteoEsperaCalculada = 0

    turnos.forEach((t) => {
      if (['llamado', 'atendido'].includes(t.estado) && t.updated_at && t.created_at) {
        const diffMs = new Date(t.updated_at) - new Date(t.created_at)
        const diffMins = diffMs / 60000
        if (diffMins >= 0 && diffMins <= 180) {
          sumaTiemposEsperaMin += diffMins
          conteoEsperaCalculada++
        }
      }
    })

    const tiempoMedioEsperaMin =
      conteoEsperaCalculada > 0
        ? Math.round(sumaTiemposEsperaMin / conteoEsperaCalculada)
        : 0

    // Desglose por sala
    const desglosePorSala = {}
    if (salas) {
      salas.forEach((s) => {
        desglosePorSala[s.id] = {
          id: s.id,
          nombre: s.nombre,
          total: 0,
          atendidos: 0,
          espera: 0,
          descartados: 0,
        }
      })
    }

    turnos.forEach((t) => {
      if (desglosePorSala[t.cola_id]) {
        desglosePorSala[t.cola_id].total++
        if (['llamado', 'atendido'].includes(t.estado)) {
          desglosePorSala[t.cola_id].atendidos++
        } else if (t.estado === 'espera') {
          desglosePorSala[t.cola_id].espera++
        } else if (t.estado === 'descartado') {
          desglosePorSala[t.cola_id].descartados++
        }
      }
    })

    // Distribución por franja horaria (de 08:00 a 21:00)
    const horasMap = {}
    for (let h = 8; h <= 20; h++) {
      horasMap[`${h}:00`] = 0
    }

    turnos.forEach((t) => {
      const fecha = new Date(t.created_at)
      const hora = fecha.getHours()
      const clave = `${hora}:00`
      if (horasMap[clave] !== undefined) {
        horasMap[clave]++
      }
    })

    const distribucionHoraria = Object.entries(horasMap).map(([hora, cantidad]) => ({
      hora,
      cantidad,
    }))

    return {
      totalTurnos,
      enEspera,
      llamadosOAtendidos,
      descartados,
      tasaAtencion,
      tiempoMedioEsperaMin,
      desgloseSalas: Object.values(desglosePorSala),
      distribucionHoraria,
    }
  } catch (error) {
    console.error('Error calculando métricas:', error)
    return null
  }
}
