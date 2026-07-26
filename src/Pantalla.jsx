import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Pantalla() {
  const [turnosPorSala, setTurnosPorSala] = useState({})
  const [salas, setSalas] = useState([])
  const [salaLlamando, setSalaLlamando] = useState(null)

  // Función para emitir un aviso sonoro agradable usando Web Audio API
  const reproducirSonido = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      
      // Primer tono (Nota más aguda)
      const osc1 = audioCtx.createOscillator()
      const gain1 = audioCtx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
      
      osc1.connect(gain1)
      gain1.connect(audioCtx.destination)
      
      osc1.start()
      osc1.stop(audioCtx.currentTime + 0.3)

      // Segundo tono (Eco de timbre)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime)
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
        
        osc2.connect(gain2)
        gain2.connect(audioCtx.destination)
        
        osc2.start()
        osc2.stop(audioCtx.currentTime + 0.5)
      }, 150)
    } catch (e) {
      console.log('El navegador bloqueó el audio automático hasta que haya interacción previa.', e)
    }
  }

  useEffect(() => {
    // 1. Cargar las salas activas y el último turno de cada una
    const cargarDatosIniciales = async () => {
      const { data: colasData, error: colasError } = await supabase
        .from('colas')
        .select('*')
        .eq('activa', true)
        .order('id', { ascending: true })

      if (colasError || !colasData) return
      setSalas(colasData)

      const turnosIniciales = {}
      for (const sala of colasData) {
        const { data: turnoData } = await supabase
          .from('turnos')
          .select('numero')
          .eq('cola_id', sala.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (turnoData && turnoData.length > 0) {
          turnosIniciales[sala.id] = turnoData[0].numero
        } else {
          turnosIniciales[sala.id] = '-'
        }
      }
      setTurnosPorSala(turnosIniciales)
    }

    cargarDatosIniciales()

    // 2. Suscribirse a Supabase Realtime
    const canalTurnos = supabase
      .channel('public:turnos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'turnos' },
        (payload) => {
          const nuevoTurno = payload.new
          
          setTurnosPorSala((prev) => ({
            ...prev,
            [nuevoTurno.cola_id]: nuevoTurno.numero
          }))

          reproducirSonido()
          setSalaLlamando(nuevoTurno.cola_id)

          // Aumentado a 12 segundos para dar tiempo a personas mayores
          setTimeout(() => {
            setSalaLlamando(null)
          }, 12000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canalTurnos)
    }
  }, [])

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1e293b', 
      color: '#fff', 
      padding: '3rem', 
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0', color: '#38bdf8' }}>Clínica Roque</h1>
        <p style={{ fontSize: '1.5rem', color: '#94a3b8', margin: 0 }}>Sala de Espera - Turnos Actuales</p>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '2rem', 
        width: '100%', 
        maxWidth: '1200px' 
      }}>
        {salas.map((sala) => {
          const estaLlamando = salaLlamando === sala.id

          return (
            <div 
              key={sala.id} 
              style={{ 
                backgroundColor: estaLlamando ? '#1e3a8a' : '#0f172a', 
                borderRadius: '20px', 
                padding: '2.5rem', 
                textAlign: 'center',
                border: estaLlamando ? '4px solid #facc15' : '2px solid #334155',
                boxShadow: estaLlamando ? '0 0 25px rgba(250, 204, 21, 0.6)' : '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                transform: estaLlamando ? 'scale(1.03)' : 'scale(1)',
                transition: 'all 0.3s ease-in-out'
              }}
            >
              <h2 style={{ fontSize: '2rem', color: estaLlamando ? '#fef08a' : '#f1f5f9', margin: '0 0 1.5rem 0', borderBottom: '2px solid #334155', paddingBottom: '10px' }}>
                {sala.nombre}
              </h2>
              <div style={{ 
                fontSize: '6rem', 
                fontWeight: 'bold', 
                color: estaLlamando ? '#facc15' : '#4ade80', 
                letterSpacing: '4px',
                margin: '1rem 0'
              }}>
                {turnosPorSala[sala.id] || '-'}
              </div>
              <p style={{ fontSize: '1.2rem', fontWeight: estaLlamando ? 'bold' : 'normal', color: estaLlamando ? '#fef08a' : '#64748b', margin: '10px 0 0 0' }}>
                {estaLlamando ? '¡LLAMANDO PACIENTE!' : 'Turno Actual'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}