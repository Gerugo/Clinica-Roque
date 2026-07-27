import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

export default function Pantalla() {
  const [turnosPorSala, setTurnosPorSala] = useState({})
  const [salas, setSalas] = useState([])
  const [audioHabilitado, setAudioHabilitado] = useState(false)
  const [llamadaActiva, setLlamadaActiva] = useState(null)
  
  const temporizadorRef = useRef(null)

  const reproducirSonido = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      
      const osc1 = audioCtx.createOscillator()
      const gain1 = audioCtx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime)
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
      
      osc1.connect(gain1)
      gain1.connect(audioCtx.destination)
      
      osc1.start()
      osc1.stop(audioCtx.currentTime + 0.3)

      setTimeout(() => {
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime)
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
        
        osc2.connect(gain2)
        gain2.connect(audioCtx.destination)
        
        osc2.start()
        osc2.stop(audioCtx.currentTime + 0.5)
      }, 150)
    } catch (e) {
      console.log('Error reproduciendo audio:', e)
    }
  }

  const habilitarAudioYPantalla = () => {
    setAudioHabilitado(true)
    reproducirSonido()
  }

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      const { data: colasData, error: colasError } = await supabase.from('colas').select('*').eq('activa', true).order('id', { ascending: true })
      if (colasError || !colasData) return
      setSalas(colasData)

      const promesasTurnos = colasData.map(sala => 
        supabase.from('turnos').select('numero').eq('cola_id', sala.id).eq('estado', 'llamado')
          .order('updated_at', { ascending: false }).limit(1)
          .then(({ data }) => ({ salaId: sala.id, numero: data && data.length > 0 ? data[0].numero : '-' }))
      )

      const resultados = await Promise.all(promesasTurnos)
      const turnosIniciales = {}
      resultados.forEach(res => { turnosIniciales[res.salaId] = res.numero })
      setTurnosPorSala(turnosIniciales)
    }

    cargarDatosIniciales()

    const canalTurnos = supabase
      .channel('public:turnos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'turnos' }, (payload) => {
        const turnoActualizado = payload.new
        
        // Si el médico descarta el turno, limpiamos la casilla en la pantalla
        if (turnoActualizado.estado === 'descartado') {
          setTurnosPorSala(prev => ({ ...prev, [turnoActualizado.cola_id]: '-' }))
          return // Detenemos aquí, no hacemos sonar la alerta
        }
        
        if (turnoActualizado.estado === 'llamado') {
          setTurnosPorSala((prev) => ({ ...prev, [turnoActualizado.cola_id]: turnoActualizado.numero }))
          reproducirSonido()
          setLlamadaActiva({ cola_id: turnoActualizado.cola_id, numero: turnoActualizado.numero })
          
          if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
          temporizadorRef.current = setTimeout(() => { setLlamadaActiva(null) }, 12000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canalTurnos)
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
    }
  }, [])

  const salaDetalle = llamadaActiva ? salas.find(s => s.id === llamadaActiva.cola_id) : null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#1e293b', color: '#fff', fontFamily: 'system-ui, sans-serif', overflowY: 'auto', zIndex: 50 }}>
      <style>{`@keyframes latido { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.02); opacity: 0.95; } 100% { transform: scale(1); opacity: 1; } }`}</style>

      {!audioHabilitado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000, textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '3rem', color: '#38bdf8', marginBottom: '1rem' }}>Pantalla de Pacientes</h2>
          <p style={{ fontSize: '1.5rem', color: '#94a3b8', marginBottom: '3rem' }}>Pulsa Iniciar para activar la pantalla completa y el sonido.</p>
          <button onClick={habilitarAudioYPantalla} style={{ padding: '20px 60px', fontSize: '2rem', fontWeight: 'bold', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(34, 197, 94, 0.4)' }}>
            Iniciar Pantalla
          </button>
        </div>
      )}

      {llamadaActiva && salaDetalle && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#1e3a8a', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100, animation: 'latido 1.5s infinite ease-in-out' }}>
          <h2 style={{ fontSize: '6vw', color: '#f1f5f9', margin: '0 0 2rem 0', letterSpacing: '5px' }}>NUEVO TURNO</h2>
          <div style={{ fontSize: '22vw', fontWeight: 'bold', color: '#facc15', lineHeight: '1', textShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>{llamadaActiva.numero}</div>
          <h1 style={{ fontSize: '8vw', color: '#fff', margin: '2rem 0 0 0', borderTop: '4px solid #facc15', paddingTop: '2rem' }}>
            Acuda a: {salaDetalle.nombre}
          </h1>
        </div>
      )}

      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '4rem', margin: '0 0 10px 0', color: '#38bdf8' }}>Clínica Roque</h1>
          <p style={{ fontSize: '1.8rem', color: '#94a3b8', margin: 0 }}>Turnos Actuales</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '3rem', width: '100%', maxWidth: '1400px' }}>
          {salas.map((sala) => (
            <div key={sala.id} style={{ backgroundColor: '#0f172a', borderRadius: '20px', padding: '3rem', textAlign: 'center', border: '2px solid #334155', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
              <h2 style={{ fontSize: '2.5rem', color: '#f1f5f9', margin: '0 0 1.5rem 0', borderBottom: '2px solid #334155', paddingBottom: '15px' }}>{sala.nombre}</h2>
              <div style={{ fontSize: '7rem', fontWeight: 'bold', color: '#4ade80', letterSpacing: '5px', margin: '1.5rem 0' }}>
                {turnosPorSala[sala.id] || '-'}
              </div>
              <p style={{ fontSize: '1.5rem', color: '#64748b', margin: '10px 0 0 0' }}>Turno Actual</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}