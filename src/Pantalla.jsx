import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

export default function Pantalla() {
  const [turnosPorSala, setTurnosPorSala] = useState({})
  const [salas, setSalas] = useState([])
  const [audioHabilitado, setAudioHabilitado] = useState(false)
  const [llamadaActiva, setLlamadaActiva] = useState(null)
  
  const temporizadorRef = useRef(null)
  const audioCtxRef = useRef(null)

  const reproducirSonido = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      
      const audioCtx = audioCtxRef.current

      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      
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
    /* CONTENEDOR PRINCIPAL: Ahora usa la imagen de fondo con la ruta exacta de la carpeta public */
    <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/1785611890284.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', color: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', zIndex: 50, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '4vh 4vw' }}>
      <style>{`@keyframes latido { 0% { transform: scale(1); text-shadow: 0 0 20px rgba(197, 160, 89, 0.3); } 50% { transform: scale(1.02); text-shadow: 0 0 40px rgba(197, 160, 89, 0.6); } 100% { transform: scale(1); text-shadow: 0 0 20px rgba(197, 160, 89, 0.3); } }`}</style>

      {/* OVERLAY DE ACTIVACIÓN: Adaptado a tonos oscuros y dorados */}
      {!audioHabilitado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20, 25, 30, 0.85)', backdropFilter: 'blur(15px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 1000, textAlign: 'center', padding: '2vw' }}>
          <h2 style={{ fontSize: 'min(4rem, 8vw)', color: '#c5a059', marginBottom: '2vh', fontWeight: '300', letterSpacing: '4px' }}>Sistema de Turnos</h2>
          <p style={{ fontSize: 'min(1.8rem, 3.5vw)', color: '#8b9a7b', marginBottom: '4vh' }}>Pulse para conectar con la base de datos de Clínica Roque.</p>
          <button onClick={habilitarAudioYPantalla} style={{ padding: '3vh 6vw', fontSize: 'min(2.5rem, 5vw)', fontWeight: 'bold', background: 'linear-gradient(135deg, #c5a059 0%, #a38241 100%)', color: '#1a1c23', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(197, 160, 89, 0.2)' }}>
            ▶ Activar Pantalla
          </button>
        </div>
      )}

      {/* OVERLAY NUEVO TURNO LLAMADO: Efecto premium en cristal oscuro con oro */}
      {llamadaActiva && salaDetalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26, 30, 36, 0.90)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <h2 style={{ fontSize: '5vw', color: '#8b9a7b', margin: '0 0 2vh 0', letterSpacing: '12px', textTransform: 'uppercase', fontWeight: '400' }}>Nuevo Turno</h2>
          <div style={{ fontSize: '28vw', fontWeight: 'bold', color: '#c5a059', lineHeight: '1', animation: 'latido 1.5s infinite ease-in-out' }}>{llamadaActiva.numero}</div>
          <h1 style={{ fontSize: '6vw', color: '#f3f4f6', margin: '3vh 0 0 0', fontWeight: '300', letterSpacing: '2px' }}>
            Por favor, acuda a <strong style={{ color: '#c5a059', fontWeight: '600' }}>{salaDetalle.nombre}</strong>
          </h1>
        </div>
      )}

      {/* CABECERA: Simplificada porque la imagen ya tiene la marca visual enorme */}
      <header style={{ textAlign: 'center', marginBottom: '4vh', flexShrink: 0 }}>
        <p style={{ fontSize: 'min(1.8rem, 3.5vh)', color: '#c5a059', margin: 0, letterSpacing: '6px', fontWeight: '300', textTransform: 'uppercase' }}>Turnos Actuales</p>
      </header>

      {/* REJILLA DE TURNOS: Efecto Glassmorphism (Cristal) para dejar ver la imagen de fondo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5vw', width: '100%', maxWidth: '95vw', margin: '0 auto', alignContent: 'center' }}>
          {salas.map((sala) => (
            <div key={sala.id} style={{ 
              background: 'rgba(30, 35, 42, 0.55)', 
              backdropFilter: 'blur(12px)', 
              borderRadius: '20px', 
              padding: '4vh 2vw', 
              textAlign: 'center', 
              border: '1px solid rgba(197, 160, 89, 0.25)', 
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center' 
            }}>
              <h2 style={{ fontSize: 'min(2.5rem, 4.5vh)', color: '#e5e7eb', margin: '0 0 1.5vh 0', fontWeight: '400', letterSpacing: '1px' }}>{sala.nombre}</h2>
              <div style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #c5a059, transparent)', margin: '0 auto 2vh auto' }}></div>
              <div style={{ fontSize: 'min(7rem, 12vh)', fontWeight: 'bold', color: '#c5a059', letterSpacing: '4px', margin: '1.5vh 0', lineHeight: '1', textShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
                {turnosPorSala[sala.id] || '-'}
              </div>
              <p style={{ fontSize: 'min(1.3rem, 2.5vh)', color: '#8b9a7b', margin: '2vh 0 0 0', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '600' }}>Turno Actual</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
