import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Admin() {
  // Estado de Seguridad
  const [autenticado, setAutenticado] = useState(false)
  const [pin, setPin] = useState('')

  // Estados de la Aplicación
  const [colas, setColas] = useState([])
  const [turnoActual, setTurnoActual] = useState({}) // Guarda el objeto turno completo { id, numero, suscripcion_push... }
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
    if (pin === '1234') { 
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

  // =========================================================
  // Función para invocar el servidor Push de Supabase
  // =========================================================
  const dispararPush = async (suscripcion, nombreSala, numero) => {
    try {
      await supabase.functions.invoke('enviar-alerta', {
        body: {
          suscripcion: suscripcion,
          sala: nombreSala,
          numero: numero
        }
      })
    } catch (error) {
      console.error("Error al enviar la notificación Push:", error)
    }
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
      
      // Disparamos el Push si el paciente aceptó notificaciones
      if (turnoALlamar.suscripcion_push) {
        const sala = colas.find(c => c.id === salaId)
        dispararPush(turnoALlamar.suscripcion_push, sala.nombre, turnoALlamar.numero)
      }

    } else {
      alert('Error al llamar al paciente.')
    }
    setCargandoCola(null)
  }

  // Volver a hacer sonar la pantalla / Push para el paciente actual
  const reLlamar = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return
    setCargandoCola(salaId)
    
    // Forzamos un evento UPDATE en Supabase
    await supabase.from('turnos').update({ estado: 'llamado' }).eq('id', turno.id)
    
    // Disparamos el Push de nuevo al re-llamar
    if (turno.suscripcion_push) {
      const sala = colas.find(c => c.id === salaId)
      dispararPush(turno.suscripcion_push, sala.nombre, turno.numero)
    }
    
    setCargandoCola(null)
  }

  // Marcar al paciente como no presentado / finalizado
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={verificarPin} style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', padding: '4rem 3rem', borderRadius: '24px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ fontSize: '3rem' }}>🩺</span>
          </div>
          <h2 style={{ color: '#f8fafc', marginBottom: '2.5rem', fontWeight: '500', letterSpacing: '1px' }}>Acceso Médico</h2>
          <input 
            type="password" 
            placeholder="****" 
            value={pin} 
            onChange={(e) => setPin(e.target.value)}
            style={{ padding: '15px', fontSize: '2rem', width: '220px', textAlign: 'center', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '2.5rem', letterSpacing: '8px', outline: 'none', transition: 'border-color 0.3s' }}
            onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
            autoFocus
          />
          <br />
          <button type="submit" style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.target.style.transform = 'scale(1)'}>
            Entrar al Panel
          </button>
        </form>
      </div>
    )
  }

  // -----------------------------------------------------
  // VISTA 2: DASHBOARD PRINCIPAL
  // -----------------------------------------------------
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(to bottom right, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2.5rem', margin: '0 0 10px 0', fontWeight: '800' }}>Panel de Administración</h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem', margin: 0, fontWeight: '500' }}>Gestión avanzada de salas y turnos</p>
      </header>

      {/* Creador de Salas */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '4rem', padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '700px', margin: '0 auto 4rem auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', border: '1px solid #f1f5f9' }}>
        <input 
          type="text" 
          placeholder="Nombre de la nueva sala (Ej: Consulta 3)..." 
          value={nuevaConsulta}
          onChange={(e) => setNuevaConsulta(e.target.value)}
          style={{ flex: 1, padding: '15px 20px', fontSize: '1.1rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#f8fafc' }}
          onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
          onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
        />
        <button 
          onClick={crearNuevaConsulta}
          disabled={creandoCola || !nuevaConsulta.trim()}
          style={{ padding: '15px 30px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: (creandoCola || !nuevaConsulta.trim()) ? '#cbd5e1' : '#0f172a', color: 'white', border: 'none', borderRadius: '10px', cursor: (creandoCola || !nuevaConsulta.trim()) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
        >
          {creandoCola ? 'Creando...' : '+ Añadir Sala'}
        </button>
      </div>

      {/* Cuadrícula de Consultas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {colas.map(sala => {
          const estaCargando = cargandoCola === sala.id
          const turno = turnoActual[sala.id]
          const enEspera = esperaPorSala[sala.id] || 0
          
          return (
            <div key={sala.id} style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '2rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', display: 'flex', flexDirection: 'column', border: '1px solid #f1f5f9', position: 'relative', overflow: 'hidden' }}>
              
              {/* Línea superior decorativa */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: enEspera > 0 ? 'linear-gradient(90deg, #3b82f6, #2dd4bf)' : '#cbd5e1' }} />

              {/* Cabecera de la Tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0, fontWeight: '700' }}>{sala.nombre}</h2>
                <button onClick={() => eliminarCola(sala.id, sala.nombre)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', padding: '5px 10px', borderRadius: '6px', transition: 'all 0.2s' }} onMouseOver={(e) => { e.target.style.backgroundColor = '#fee2e2'; e.target.style.color = '#ef4444'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#94a3b8'; }}>
                  Eliminar
                </button>
              </div>

              {/* Indicador de Espera */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: enEspera > 0 ? '#eff6ff' : '#f8fafc', color: enEspera > 0 ? '#1d4ed8' : '#64748b', padding: '8px 20px', borderRadius: '30px', fontSize: '0.95rem', fontWeight: '600', border: `1px solid ${enEspera > 0 ? '#bfdbfe' : '#e2e8f0'}` }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: enEspera > 0 ? '#3b82f6' : '#cbd5e1', animation: enEspera > 0 ? 'pulse 2s infinite' : 'none' }}></span>
                  Pacientes en espera: {enEspera}
                </div>
              </div>

              {/* Turno Actual */}
              <div style={{ textAlign: 'center', margin: '1.5rem 0 2rem 0', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.95rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>En consulta ahora</p>
                <div style={{ fontSize: '4.5rem', fontWeight: '800', color: turno ? '#0f172a' : '#cbd5e1', letterSpacing: '2px', lineHeight: '1' }}>
                  {turno ? turno.numero : '-'}
                </div>
              </div>

              {/* Botones de Acción Secundaria (Rellamar / Descartar) */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', minHeight: '45px' }}>
                {turno && (
                  <>
                    <button 
                      onClick={() => reLlamar(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '12px', backgroundColor: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '10px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: '700', fontSize: '0.95rem', transition: 'background-color 0.2s' }}
                      onMouseOver={(e) => !estaCargando && (e.target.style.backgroundColor = '#e0f2fe')} onMouseOut={(e) => !estaCargando && (e.target.style.backgroundColor = '#f0f9ff')}
                    >
                      🔔 Re-llamar
                    </button>
                    <button 
                      onClick={() => descartarTurno(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: '700', fontSize: '0.95rem', transition: 'background-color 0.2s' }}
                      onMouseOver={(e) => !estaCargando && (e.target.style.backgroundColor = '#fee2e2')} onMouseOut={(e) => !estaCargando && (e.target.style.backgroundColor = '#fef2f2')}
                    >
                      ✕ Descartar
                    </button>
                  </>
                )}
              </div>

              {/* Botón Principal (Llamar Siguiente) */}
              <button 
                onClick={() => llamarSiguiente(sala.id)}
                disabled={estaCargando || enEspera === 0}
                style={{ marginTop: 'auto', padding: '18px', width: '100%', cursor: (estaCargando || enEspera === 0) ? 'not-allowed' : 'pointer', background: (estaCargando || enEspera === 0) ? '#f1f5f9' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: (estaCargando || enEspera === 0) ? '#94a3b8' : 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', boxShadow: (estaCargando || enEspera === 0) ? 'none' : '0 10px 15px -3px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s, box-shadow 0.1s' }}
                onMouseDown={(e) => { if(!estaCargando && enEspera > 0) e.target.style.transform = 'scale(0.98)' }} 
                onMouseUp={(e) => { if(!estaCargando && enEspera > 0) e.target.style.transform = 'scale(1)' }}
              >
                {estaCargando ? 'Procesando...' : 'Llamar Siguiente'}
              </button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }`}</style>
    </div>
  )
}