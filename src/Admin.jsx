import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Admin() {
  // Estado de Seguridad
  const [autenticado, setAutenticado] = useState(false)
  const [pin, setPin] = useState('')

  // Estados de la Aplicación
  const [colas, setColas] = useState([])
  const [turnoActual, setTurnoActual] = useState({}) // Guarda el objeto turno completo { id, numero }
  const [esperaPorSala, setEsperaPorSala] = useState({}) // Contador de pacientes esperando
  const [nuevaConsulta, setNuevaConsulta] = useState('')
  const [creandoCola, setCreandoCola] = useState(false)
  const [cargandoCola, setCargandoCola] = useState(null)

  // Carga inicial de datos
  useEffect(() => {
    if (!autenticado) return

    const cargarDatos = async () => {
      const { data: colasData, error: colasError } = await supabase
        .from('colas')
        .select('*')
        .eq('activa', true)
        .order('id', { ascending: true })
      
      if (colasError || !colasData) return
      setColas(colasData)

      const promesas = colasData.map(async (sala) => {
        // 1. Obtener el último turno llamado
        const { data: dataLlamado } = await supabase
          .from('turnos')
          .select('*')
          .eq('cola_id', sala.id)
          .eq('estado', 'llamado')
          .order('updated_at', { ascending: false })
          .limit(1)

        // 2. Obtener la cantidad de pacientes en espera
        const { count: countEspera } = await supabase
          .from('turnos')
          .select('*', { count: 'exact', head: true })
          .eq('cola_id', sala.id)
          .eq('estado', 'espera')

        return {
          salaId: sala.id,
          ultimoTurno: dataLlamado && dataLlamado.length > 0 ? dataLlamado[0] : null,
          espera: countEspera || 0
        }
      })

      const resultados = await Promise.all(promesas)
      
      const turnosIniciales = {}
      const esperasIniciales = {}
      
      resultados.forEach(res => {
        turnosIniciales[res.salaId] = res.ultimoTurno
        esperasIniciales[res.salaId] = res.espera
      })
      
      setTurnoActual(turnosIniciales)
      setEsperaPorSala(esperasIniciales)
    }

    cargarDatos()

    // Suscripción para actualizar el contador de espera en tiempo real cuando un paciente coge turno
    const canalAdmin = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'turnos' }, (payload) => {
        if (payload.new.estado === 'espera') {
          setEsperaPorSala(prev => ({
            ...prev,
            [payload.new.cola_id]: (prev[payload.new.cola_id] || 0) + 1
          }))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(canalAdmin)
  }, [autenticado])

  // Lógica de Seguridad
  const verificarPin = (e) => {
    e.preventDefault()
    if (pin === '1234') { // <-- Puedes cambiar este PIN de seguridad aquí
      setAutenticado(true)
    } else {
      alert('PIN incorrecto. Acceso denegado.')
      setPin('')
    }
  }

  const crearNuevaConsulta = async () => {
    if (!nuevaConsulta.trim()) return
    setCreandoCola(true)
    const { data, error } = await supabase.from('colas').insert([{ nombre: nuevaConsulta.trim(), activa: true }]).select()
    if (!error && data && data.length > 0) {
      setColas([...colas, data[0]])
      setNuevaConsulta('')
    } else {
      alert('Hubo un error al crear la sala.')
    }
    setCreandoCola(false)
  }

  const eliminarCola = async (salaId, nombreSala) => {
    const confirmacion = window.confirm(`¿Estás seguro de que quieres eliminar la sala "${nombreSala}"?`)
    if (!confirmacion) return
    const { error } = await supabase.from('colas').update({ activa: false }).eq('id', salaId)
    if (!error) setColas(colas.filter(c => c.id !== salaId))
  }

  // Lógica Principal: Llamar al siguiente de la cola
  const llamarSiguiente = async (salaId) => {
    setCargandoCola(salaId)
    
    const { data: turnosEspera, error: errorBusqueda } = await supabase
      .from('turnos').select('*').eq('cola_id', salaId).eq('estado', 'espera')
      .order('created_at', { ascending: true }).limit(1)

    if (errorBusqueda) {
      alert('Error de conexión.')
      setCargandoCola(null)
      return
    }

    if (!turnosEspera || turnosEspera.length === 0) {
      alert('No hay pacientes en la sala de espera para esta consulta.')
      setCargandoCola(null)
      return
    }

    const turnoALlamar = turnosEspera[0]
    const { error: errorUpdate } = await supabase
      .from('turnos').update({ estado: 'llamado' }).eq('id', turnoALlamar.id)

    if (!errorUpdate) {
      setTurnoActual(prev => ({ ...prev, [salaId]: turnoALlamar }))
      setEsperaPorSala(prev => ({ ...prev, [salaId]: Math.max(0, (prev[salaId] || 1) - 1) }))
    } else {
      alert('Error al llamar al paciente.')
    }
    setCargandoCola(null)
  }

  // NUEVA LÓGICA: Volver a hacer sonar la pantalla para el paciente actual
  const reLlamar = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return
    setCargandoCola(salaId)
    
    // Forzamos un evento UPDATE en Supabase para que la pantalla y el móvil lo detecten
    await supabase.from('turnos').update({ estado: 'llamado' }).eq('id', turno.id)
    
    setCargandoCola(null)
  }

  // NUEVA LÓGICA: Marcar al paciente como no presentado / finalizado
  const descartarTurno = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return
    
    const confirmacion = window.confirm(`¿Descartar el turno ${turno.numero}? Desaparecerá de la pantalla.`)
    if (!confirmacion) return

    setCargandoCola(salaId)
    await supabase.from('turnos').update({ estado: 'descartado' }).eq('id', turno.id)
    setTurnoActual(prev => ({ ...prev, [salaId]: null }))
    setCargandoCola(null)
  }

  // -----------------------------------------------------
  // VISTA 1: PANTALLA DE LOGIN / PIN
  // -----------------------------------------------------
  if (!autenticado) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={verificarPin} style={{ backgroundColor: '#1e293b', padding: '3rem', borderRadius: '15px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <h2 style={{ color: '#fff', marginBottom: '2rem' }}>Panel de Control Médico</h2>
          <input 
            type="password" 
            placeholder="PIN de acceso" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)}
            style={{ padding: '15px', fontSize: '1.5rem', width: '200px', textAlign: 'center', borderRadius: '8px', border: 'none', marginBottom: '2rem', letterSpacing: '5px' }}
            autoFocus
          />
          <br />
          <button type="submit" style={{ padding: '15px 40px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }}>
            Entrar
          </button>
        </form>
      </div>
    )
  }

  // -----------------------------------------------------
  // VISTA 2: DASHBOARD PRINCIPAL
  // -----------------------------------------------------
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2.5rem', margin: '0 0 10px 0' }}>Panel de Administración</h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem', margin: 0 }}>Gestión avanzada de llamadas</p>
      </header>

      {/* Creador de Salas */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '3rem', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', maxWidth: '600px', margin: '0 auto 3rem auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <input 
          type="text" 
          placeholder="Añadir nueva sala (Ej: Dr. López)..." 
          value={nuevaConsulta}
          onChange={(e) => setNuevaConsulta(e.target.value)}
          style={{ flex: 1, padding: '12px 15px', fontSize: '1.1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        />
        <button 
          onClick={crearNuevaConsulta}
          disabled={creandoCola || !nuevaConsulta.trim()}
          style={{ padding: '12px 25px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: (creandoCola || !nuevaConsulta.trim()) ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: (creandoCola || !nuevaConsulta.trim()) ? 'not-allowed' : 'pointer' }}
        >
          {creandoCola ? 'Creando...' : '+ Añadir'}
        </button>
      </div>

      {/* Cuadrícula de Consultas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {colas.map(sala => {
          const estaCargando = cargandoCola === sala.id
          const turno = turnoActual[sala.id]
          const enEspera = esperaPorSala[sala.id] || 0
          
          return (
            <div key={sala.id} style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
              
              {/* Cabecera de la Tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: 0 }}>{sala.nombre}</h2>
                <button onClick={() => eliminarCola(sala.id, sala.nombre)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  Eliminar
                </button>
              </div>

              {/* Indicador de Espera */}
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ backgroundColor: enEspera > 0 ? '#fef08a' : '#e2e8f0', color: enEspera > 0 ? '#854d0e' : '#64748b', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  Pacientes esperando: {enEspera}
                </span>
              </div>

              {/* Turno Actual */}
              <div style={{ textAlign: 'center', margin: '1rem 0' }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '1rem' }}>En consulta ahora:</p>
                <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: turno ? '#0f172a' : '#cbd5e1', letterSpacing: '3px', lineHeight: '1.2' }}>
                  {turno ? turno.numero : '-'}
                </div>
              </div>

              {/* Botones de Acción Secundaria (Rellamar / Descartar) */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', minHeight: '40px' }}>
                {turno && (
                  <>
                    <button 
                      onClick={() => reLlamar(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '8px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      Re-llamar
                    </button>
                    <button 
                      onClick={() => descartarTurno(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
                      Descartar
                    </button>
                  </>
                )}
              </div>

              {/* Botón Principal (Llamar Siguiente) */}
              <button 
                onClick={() => llamarSiguiente(sala.id)}
                disabled={estaCargando || enEspera === 0}
                style={{ marginTop: 'auto', padding: '15px', width: '100%', cursor: (estaCargando || enEspera === 0) ? 'not-allowed' : 'pointer', backgroundColor: (estaCargando || enEspera === 0) ? '#a7f3d0' : '#22c55e', color: (estaCargando || enEspera === 0) ? '#064e3b' : 'white', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: (estaCargando || enEspera === 0) ? 'none' : '0 4px 6px -1px rgba(34, 197, 94, 0.4)', transition: 'all 0.2s' }}
              >
                {estaCargando ? 'Cargando...' : 'Llamar Siguiente'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}