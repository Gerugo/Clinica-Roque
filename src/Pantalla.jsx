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
        
        if (turnoActualizado.estado === 'descartado') {
          setTurnosPorSala(prev => ({ ...prev, [turnoActualizado.cola_id]: '-' }))
          return 
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
    /* CONTENEDOR PRINCIPAL: Flexbox, 100vh exacto y bloqueo absoluto de scroll (overflow: hidden) */
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', zIndex: 50, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '3vh 3vw' }}>
      <style>{`@keyframes latido { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.02); opacity: 0.95; } 100% { transform: scale(1); opacity: 1; } }`}</style>

      {/* OVERLAY DE ACTIVACIÓN */}
      {!audioHabilitado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000, textAlign: 'center', padding: '2vw' }}>
          <h2 style={{ fontSize: 'min(4rem, 8vw)', color: '#38bdf8', marginBottom: '2vh', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>Pantalla de Pacientes</h2>
          <p style={{ fontSize: 'min(1.8rem, 3.5vw)', color: '#e2e8f0', marginBottom: '4vh' }}>Pulsa Iniciar para activar la pantalla completa y el sonido.</p>
          <button onClick={habilitarAudioYPantalla} style={{ padding: '3vh 6vw', fontSize: 'min(2.5rem, 5vw)', fontWeight: 'bold', background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(34, 197, 94, 0.4)' }}>
            ▶ Iniciar Pantalla
          </button>
        </div>
      )}

      {/* OVERLAY NUEVO TURNO LLAMADO */}
      {llamadaActiva && salaDetalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100, animation: 'latido 1.5s infinite ease-in-out' }}>
          <h2 style={{ fontSize: '6vw', color: '#e0e7ff', margin: '0 0 2vh 0', letterSpacing: '8px', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>NUEVO TURNO</h2>
          <div style={{ fontSize: '25vw', fontWeight: 'bold', color: '#facc15', lineHeight: '1', textShadow: '0 15px 30px rgba(0,0,0,0.4)' }}>{llamadaActiva.numero}</div>
          <h1 style={{ fontSize: '7vw', color: '#ffffff', margin: '4vh 0 0 0', borderTop: '4px solid rgba(250, 204, 21, 0.5)', paddingTop: '2vh', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
            Acuda a: {salaDetalle.nombre}
          </h1>
        </div>
      )}

      {/* CABECERA (Ajustada dinámicamente) */}
      <header style={{ textAlign: 'center', marginBottom: '2vh', flexShrink: 0 }}>
        <h1 style={{ fontSize: 'min(4rem, 7vh)', margin: '0 0 1vh 0', background: '-webkit-linear-gradient(45deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Clínica Roque</h1>
        <p style={{ fontSize: 'min(1.5rem, 3vh)', color: '#94a3b8', margin: 0, letterSpacing: '2px' }}>TURNOS ACTUALES</p>
      </header>

      {/* REJILLA DE TURNOS (Toma el espacio restante y se auto-centra) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2vw', width: '100%', maxWidth: '95vw', margin: '0 auto', alignContent: 'center' }}>
          {salas.map((sala) => (
            <div key={sala.id} style={{ background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', padding: '3vh 2vw', textAlign: 'center', border: '1px solid #334155', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ fontSize: 'min(2.5rem, 4.5vh)', color: '#f8fafc', margin: '0 0 1.5vh 0', borderBottom: '1px solid #334155', paddingBottom: '1.5vh' }}>{sala.nombre}</h2>
              <div style={{ fontSize: 'min(7rem, 12vh)', fontWeight: 'bold', color: '#4ade80', letterSpacing: '5px', margin: '1.5vh 0', textShadow: '0 0 20px rgba(74, 222, 128, 0.2)', lineHeight: '1' }}>
                {turnosPorSala[sala.id] || '-'}
              </div>
              <p style={{ fontSize: 'min(1.3rem, 2.5vh)', color: '#64748b', margin: '1vh 0 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Turno Actual</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}