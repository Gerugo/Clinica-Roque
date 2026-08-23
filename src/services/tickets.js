import { generarCodigoTurno } from '../utils/ticketCode.js'
import { ETA_CONFIG } from '../utils/constants.js'
import { imprimirTicketPapel } from './printer.js'
import { enviarAlertaPush } from './push.js'
import { supabase } from './supabase.js'

/**
 * Solicita un nuevo turno desde el dispositivo del paciente
 */
export async function solicitarTurnoPaciente(salaId, suscripcionPush = null) {
  const nuevoCodigo = generarCodigoTurno(3)

  const { data, error } = await supabase
    .from('turnos')
    .insert([
      {
        cola_id: salaId,
        numero: nuevoCodigo,
        estado: 'espera',
        suscripcion_push: suscripcionPush,
      },
    ])
    .select('id, numero, cola_id, estado, created_at')

  if (error || !data || data.length === 0) {
    console.error('Error al solicitar turno:', error)
    return { data: null, error: error || new Error('No se pudo crear el turno') }
  }

  return { data: data[0], error: null }
}

/**
 * Genera un turno manual e imprime el ticket en papel
 */
export async function crearTurnoManualConImpresion(salaId, nombreSala) {
  const nuevoCodigo = generarCodigoTurno(3)

  const { data, error } = await supabase
    .from('turnos')
    .insert([
      {
        cola_id: salaId,
        numero: nuevoCodigo,
        estado: 'espera',
        suscripcion_push: null,
      },
    ])
    .select('id, numero, cola_id, estado')

  if (error || !data || !data.length) {
    console.error('Error al crear turno manual:', error)
    return { exito: false, error }
  }

  // Imprimir ticket en papel físico
  imprimirTicketPapel(nombreSala, nuevoCodigo)

  return { exito: true, turno: data[0], error: null }
}

/**
 * Llama al siguiente paciente de una sala
 * Utiliza la función PostgreSQL atómica 'llamar_siguiente_turno' (FOR UPDATE SKIP LOCKED)
 * si está disponible; de lo contrario usa fallback seguro.
 */
export async function llamarSiguientePaciente(salaId, nombreSala) {
  try {
    // 1. Intentar llamar mediante la función RPC atómica
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'llamar_siguiente_turno',
      { p_cola_id: Number(salaId) }
    )

    if (!rpcError && rpcData) {
      if (!rpcData.exito) {
        return { exito: false, mensaje: rpcData.mensaje || 'No hay pacientes en espera' }
      }

      const turnoLlamado = rpcData.turno_llamado
      const turnoPreaviso = rpcData.turno_preaviso

      // Enviar push al paciente llamado
      if (turnoLlamado && turnoLlamado.suscripcion_push) {
        enviarAlertaPush({
          suscripcion: turnoLlamado.suscripcion_push,
          salaNombre: nombreSala || turnoLlamado.sala_nombre,
          numeroTurno: turnoLlamado.numero,
          tipoAlerta: 'llamado',
          turnoId: turnoLlamado.id,
        })
      }

      // Enviar preaviso al 4to paciente si aplica
      if (turnoPreaviso && turnoPreaviso.suscripcion_push) {
        enviarAlertaPush({
          suscripcion: turnoPreaviso.suscripcion_push,
          salaNombre: nombreSala || turnoPreaviso.sala_nombre,
          numeroTurno: turnoPreaviso.numero,
          tipoAlerta: 'preaviso',
          turnoId: turnoPreaviso.id,
        })
      }

      return {
        exito: true,
        turnoLlamado,
        turnoPreaviso,
      }
    }
  } catch (e) {
    console.warn('RPC llamar_siguiente_turno no disponible, usando fallback cliente:', e)
  }

  // 2. Fallback de cliente si la función RPC aún no fue ejecutada en Supabase
  const { data: turnosEspera, error: errorBusqueda } = await supabase
    .from('turnos')
    .select('*')
    .eq('cola_id', salaId)
    .eq('estado', 'espera')
    .order('created_at', { ascending: true })
    .limit(4)

  if (errorBusqueda || !turnosEspera || turnosEspera.length === 0) {
    return { exito: false, mensaje: 'No hay pacientes en espera' }
  }

  const turnoALlamar = turnosEspera[0]
  const { error: errorUpdate } = await supabase
    .from('turnos')
    .update({ estado: 'llamado' })
    .eq('id', turnoALlamar.id)

  if (errorUpdate) {
    return { exito: false, mensaje: 'Error al actualizar el estado del turno' }
  }

  // Disparar alertas push
  if (turnoALlamar.suscripcion_push) {
    enviarAlertaPush({
      suscripcion: turnoALlamar.suscripcion_push,
      salaNombre: nombreSala,
      numeroTurno: turnoALlamar.numero,
      tipoAlerta: 'llamado',
      turnoId: turnoALlamar.id,
    })
  }

  const pacientePreaviso = turnosEspera[3]
  if (
    pacientePreaviso &&
    pacientePreaviso.suscripcion_push &&
    !pacientePreaviso.preaviso_enviado
  ) {
    enviarAlertaPush({
      suscripcion: pacientePreaviso.suscripcion_push,
      salaNombre: nombreSala,
      numeroTurno: pacientePreaviso.numero,
      tipoAlerta: 'preaviso',
      turnoId: pacientePreaviso.id,
    })
    await supabase
      .from('turnos')
      .update({ preaviso_enviado: true })
      .eq('id', pacientePreaviso.id)
  }

  return { exito: true, turnoLlamado: turnoALlamar }
}

/**
 * Vuelve a llamar a un turno ya en consulta
 */
export async function reLlamarPaciente(turno, nombreSala) {
  if (!turno || !turno.id) return { exito: false }

  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'llamado' })
    .eq('id', turno.id)

  if (error) {
    console.error('Error al re-llamar turno:', error)
    return { exito: false, error }
  }

  if (turno.suscripcion_push) {
    enviarAlertaPush({
      suscripcion: turno.suscripcion_push,
      salaNombre: nombreSala,
      numeroTurno: turno.numero,
      tipoAlerta: 'llamado',
      turnoId: turno.id,
    })
  }

  return { exito: true }
}

/**
 * Finaliza la consulta médica de un paciente con éxito (estado = 'atendido')
 */
export async function finalizarConsultaPaciente(turnoId) {
  if (!turnoId) return { exito: false }

  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'atendido' })
    .eq('id', turnoId)

  if (error) {
    console.error('Error al finalizar consulta:', error)
    return { exito: false, error }
  }

  return { exito: true }
}

/**
 * Descarta un turno (paciente no asistió o canceló)
 */
export async function descartarPaciente(turnoId) {
  if (!turnoId) return { exito: false }

  const { error } = await supabase
    .from('turnos')
    .update({ estado: 'descartado' })
    .eq('id', turnoId)

  if (error) {
    console.error('Error al descartar turno:', error)
    return { exito: false, error }
  }

  return { exito: true }
}

/**
 * Recupera un turno existente por sala y código
 */
export async function recuperarTurnoPorCodigo(salaId, codigo) {
  const codigoLimpio = codigo ? codigo.trim().toUpperCase() : ''
  if (!salaId || !codigoLimpio) {
    return { data: null, error: new Error('Código y sala requeridos') }
  }

  const { data, error } = await supabase
    .from('turnos')
    .select('id, numero, cola_id, estado')
    .eq('cola_id', Number(salaId))
    .eq('numero', codigoLimpio)
    .in('estado', ['espera', 'llamado'])

  if (error) {
    return { data: null, error }
  }

  if (!data || data.length === 0) {
    return { data: null, error: new Error('No se encontró ningún turno activo con ese código') }
  }

  if (data.length > 1) {
    return {
      data: null,
      error: new Error('Existen varios turnos con ese código. Consulta en el mostrador.'),
    }
  }

  return { data: data[0], error: null }
}

/**
 * Calcula posición y tiempo estimado de espera para un turno
 */
export async function calcularMetricasTurno(colaId, turnoId) {
  try {
    // 1. Pacientes delante en espera
    const { count } = await supabase
      .from('turnos')
      .select('*', { count: 'exact', head: true })
      .eq('cola_id', colaId)
      .eq('estado', 'espera')
      .lt('id', turnoId)

    const personasAdelante = count || 0

    // 2. Histórico de duración de consultas
    const { data: historico } = await supabase
      .from('turnos')
      .select('created_at, updated_at')
      .eq('cola_id', colaId)
      .in('estado', ['llamado', 'atendido'])
      .order('updated_at', { ascending: false })
      .limit(ETA_CONFIG.MAX_MUESTRAS_HISTORICO)

    let minutosPorPaciente = ETA_CONFIG.MINUTOS_DEFAULT_POR_PACIENTE

    if (historico && historico.length >= 2) {
      const duraciones = []
      for (let i = 0; i < historico.length - 1; i++) {
        const t1 = new Date(historico[i].updated_at || historico[i].created_at).getTime()
        const t2 = new Date(historico[i + 1].updated_at || historico[i + 1].created_at).getTime()
        const diffMins = Math.abs(t1 - t2) / 60000

        if (
          diffMins >= ETA_CONFIG.MIN_MINUTOS_CONSULTA &&
          diffMins <= ETA_CONFIG.MAX_MINUTOS_CONSULTA
        ) {
          duraciones.push(diffMins)
        }
      }

      if (duraciones.length > 0) {
        const suma = duraciones.reduce((a, b) => a + b, 0)
        minutosPorPaciente = suma / duraciones.length
      }
    }

    // 3. Tiempo transcurrido del paciente actualmente en consulta
    let tiempoRestanteActual = 0
    const { data: pacienteEnConsulta } = await supabase
      .from('turnos')
      .select('updated_at')
      .eq('cola_id', colaId)
      .eq('estado', 'llamado')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (pacienteEnConsulta && pacienteEnConsulta.length > 0) {
      const horaEntrada = new Date(pacienteEnConsulta[0].updated_at).getTime()
      const horaActual = Date.now()
      const minutosDentro = Math.max(0, (horaActual - horaEntrada) / 60000)
      tiempoRestanteActual = Math.max(0, minutosPorPaciente - minutosDentro)
    }

    const tiempoEnSala = personasAdelante * minutosPorPaciente
    const minutosEstimados = Math.round(tiempoEnSala + tiempoRestanteActual)

    return {
      personasAdelante,
      minutosEstimados,
    }
  } catch (error) {
    console.error('Error calculando métricas de turno:', error)
    return { personasAdelante: 0, minutosEstimados: 0 }
  }
}
