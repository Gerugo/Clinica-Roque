import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Recepcion() {
  const [salas, setSalas] = useState([])
  const [miTurno, setMiTurno] = useState(null)
  const [estadoTurno, setEstadoTurno] = useState('espera')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const obtenerSalas = async () => {
      const { data } = await supabase.from('colas').select('*').eq('activa', true).order('nombre', { ascending: true })
      if (data) setSalas(data)
    }
    obtenerSalas()
  }, [])

  useEffect(() => {
    if (!miTurno) return
    const canalPaciente = supabase
      .channel(`paciente-${miTurno.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'turnos' }, (payload) => {
        const turnoActualizado = payload.new
        // Si el estado cambia a llamado (o el médico aprieta re-llamar)
        if (turnoActualizado.id === miTurno.id && turnoActualizado.estado === 'llamado') {
          setEstadoTurno('llamado')
          if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300])
        }
      })
      .subscribe()

    return () => supabase.removeChannel(canalPaciente)
  }, [miTurno])

  const generarCodigo = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 3; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    return codigo
  }

  const pedirTurno = async (sala) => {
    setCargando(true)
    const nuevoCodigo = generarCodigo()
    const { data, error } = await supabase
      .from('turnos').insert([{ cola_id: sala.id, numero: nuevoCodigo, estado: 'espera' }]).select()

    if (!error && data && data.length > 0) {
      setMiTurno({ id: data[0].id, numero: nuevoCodigo, sala: sala.nombre })
      setEstadoTurno('espera')
    } else {
      alert('Error al solicitar el turno.')
    }
    setCargando(false)
  }

  if (miTurno && estadoTurno === 'llamado') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#22c55e', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <style>{`@keyframes parpadeo { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }`}</style>
        <div style={{ animation: 'parpadeo 1s infinite' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>¡ES SU TURNO!</h1>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'normal', margin: '0 0 2rem 0' }}>Diríjase a:</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', backgroundColor: 'white', color: '#166534', padding: '15px 30px', borderRadius: '15px', marginBottom: '2rem' }}>{miTurno.sala}</div>
          <div style={{ fontSize: '1.5rem' }}>Su código era: {miTurno.numero}</div>
        </div>
        <button onClick={() => { setMiTurno(null); setEstadoTurno('espera'); }} style={{ marginTop: '4rem', padding: '15px 30px', fontSize: '1.2rem', backgroundColor: 'transparent', border: '2px solid white', color: 'white', borderRadius: '10px', cursor: 'pointer' }}>
          Finalizar
        </button>
      </div>
    )
  }

  if (miTurno && estadoTurno === 'espera') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ color: '#64748b', fontSize: '1.5rem' }}>Su turno para {miTurno.sala} es:</h2>
        <div style={{ fontSize: '6rem', fontWeight: 'bold', color: '#0ea5e9', margin: '2rem 0', letterSpacing: '5px' }}>{miTurno.numero}</div>
        <p style={{ color: '#334155', fontSize: '1.2rem', padding: '0 20px', marginBottom: '2rem' }}>
          Por favor, tome asiento. Su móvil le avisará cuando sea su turno.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
           <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTop: '4px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '2rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: '0 0 10px 0' }}>Bienvenido a Clínica Roque</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Seleccione la consulta a la que desea acudir:</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '0 auto' }}>
        {salas.map(sala => (
          <button key={sala.id} onClick={() => pedirTurno(sala)} disabled={cargando} style={{ padding: '20px', backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', color: '#334155', cursor: cargando ? 'wait' : 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            {sala.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}