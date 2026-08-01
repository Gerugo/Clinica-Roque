import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import InstallButton from './InstallButton'

const PUBLIC_VAPID_KEY = 'BLwFdwnK3Qh0TUVGdSu0uSIJltf6pMpybCqagPIzWiTL4ZSlQjgeUnIFlqXHM3vnCemBDcCgmd_uTICoNhIN2gQ';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Recepcion() {
  const [salas, setSalas] = useState([])
  const [misTurnos, setMisTurnos] = useState([]) 
  const [cargando, setCargando] = useState(false)

  // Función para emitir un pitido suave en el móvil del paciente
  const reproducirSonidoMovil = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime) // Volumen bajo y elegante
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.5)
    } catch (e) {
      console.log('Audio no soportado en este navegador')
    }
  }

  // 1. Carga inicial de datos y recuperación de turnos
  useEffect(() => {
    const obtenerDatos = async () => {
      const { data: salasData } = await supabase.from('colas').select('*').eq('activa', true).order('nombre', { ascending: true })
      if (salasData) setSalas(salasData)

      const turnosGuardados = JSON.parse(localStorage.getItem('turnos_paciente') || '[]')
      if (turnosGuardados.length > 0) {
        const ids = turnosGuardados.map(t => t.id)
        const { data: turnosBD } = await supabase.from('turnos').select('id, estado').in('id', ids)
        
        if (turnosBD) {
          const turnosValidos = turnosGuardados.filter(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return dbT && (dbT.estado === 'espera' || dbT.estado === 'llamado')
          }).map(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return { ...t, estado: dbT.estado } 
          })
          setMisTurnos(turnosValidos)
        } else {
          setMisTurnos(turnosGuardados)
        }
      }
    }
    obtenerDatos()
  }, [])

  // 2. Guardar en localStorage cada vez que la lista cambia
  useEffect(() => {
    localStorage.setItem('turnos_paciente', JSON.stringify(misTurnos))
  }, [misTurnos])

  // 3. Suscripción Realtime 
  useEffect(() => {
    const canalPaciente = supabase
      .channel('paciente-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'turnos' }, (payload) => {
        const turnoActualizado = payload.new
        
        setMisTurnos(prevTurnos => {
          const index = prevTurnos.findIndex(t => t.id === turnoActualizado.id)
          if (index === -1) return prevTurnos 

          if (turnoActualizado.estado === 'descartado') {
            return prevTurnos.filter(t => t.id !== turnoActualizado.id)
          }

          const nuevosTurnos = [...prevTurnos]
          
          // Detectamos si acaba de ser llamado
          if (turnoActualizado.estado === 'llamado' && prevTurnos[index].estado !== 'llamado') {
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300])
            reproducirSonidoMovil() // Disparamos el sonido
          }
          
          nuevosTurnos[index] = { ...nuevosTurnos[index], estado: turnoActualizado.estado }
          return nuevosTurnos
        })
      })
      .subscribe()

    return () => supabase.removeChannel(canalPaciente)
  }, []) 

  // 4. Wake Lock API
  useEffect(() => {
    let wakeLock = null;
    const solicitarPantallaEncendida = async () => {
      try {
        const hayEspera = misTurnos.some(t => t.estado === 'espera')
        if ('wakeLock' in navigator && hayEspera) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log(`Wake Lock no activo`);
      }
    };
    solicitarPantallaEncendida();
    return () => {
      if (wakeLock !== null) wakeLock.release();
    };
  }, [misTurnos]);

  const generarCodigo = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 3; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    return codigo
  }

  const obtenerSuscripcionPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') return null;
      const registro = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
      return suscripcion.toJSON();
    } catch (error) {
      console.error('Error Web Push:', error);
      return null;
    }
  }

  const pedirTurno = async (sala) => {
    if (misTurnos.some(t => t.cola_id === sala.id)) {
      alert(`Ya tienes un turno activo para ${sala.nombre}`);
      return;
    }

    setCargando(true)
    const nuevoCodigo = generarCodigo()
    const datosPush = await obtenerSuscripcionPush();

    const { data, error } = await supabase
      .from('turnos')
      .insert([{ cola_id: sala.id, numero: nuevoCodigo, estado: 'espera', suscripcion_push: datosPush }])
      .select()

    if (!error && data && data.length > 0) {
      const nuevoTurno = { id: data[0].id, numero: nuevoCodigo, sala: sala.nombre, cola_id: sala.id, estado: 'espera' }
      setMisTurnos([...misTurnos, nuevoTurno])
    } else {
      alert('Error al solicitar el turno.')
    }
    setCargando(false)
  }

  const probarNotificacion = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Su navegador no soporta notificaciones web.'); return;
    }
    if (Notification.permission !== 'granted') {
      alert('Debe permitir las notificaciones al navegador.'); return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('🔔 Prueba de aviso', {
        body: 'Si su móvil ha vibrado y sonado, ¡todo está configurado correctamente!',
        vibrate: [300, 100, 300, 100, 300], requireInteraction: true, tag: 'prueba-alerta'
      });
    } catch (error) { console.error(error); }
  };


  // EVALUACIÓN DE PANTALLAS
  const turnoLlamado = misTurnos.find(t => t.estado === 'llamado')
  const turnosEnEspera = misTurnos.filter(t => t.estado === 'espera')

  // PANTALLA 1: TURNO LLAMADO
  if (turnoLlamado) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <style>{`@keyframes parpadeo { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }`}</style>
        <div style={{ animation: 'parpadeo 1s infinite' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 1rem 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>¡ES SU TURNO!</h1>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'normal', margin: '0 0 2rem 0' }}>Diríjase a:</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', backgroundColor: 'white', color: '#064e3b', padding: '15px 30px', borderRadius: '15px', marginBottom: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>{turnoLlamado.sala}</div>
          <div style={{ fontSize: '1.5rem', opacity: '0.9' }}>Su código era: <span style={{fontWeight: 'bold'}}>{turnoLlamado.numero}</span></div>
        </div>
        
        <button onClick={() => setMisTurnos(prev => prev.filter(t => t.id !== turnoLlamado.id))} style={{ marginTop: '4rem', padding: '15px 30px', fontSize: '1.2rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.5)', color: 'white', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.3s' }}>
          Entendido / Finalizar
        </button>
      </div>
    )
  }

  // PANTALLA 2: DASHBOARD DEL PACIENTE CON FONDO CORPORATIVO
  return (
    <div style={{ 
      padding: '1.5rem', 
      fontFamily: 'system-ui, sans-serif', 
      minHeight: '100vh',
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.95)), url('/fondousuario.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>
      
      <header style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '1rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: '0 0 5px 0' }}>Clínica Roque</h1>
      </header>

      <InstallButton />

      {turnosEnEspera.length > 0 && (
        <div style={{ marginBottom: '3rem', maxWidth: '400px', margin: '0 auto 3rem auto' }}>
          <h2 style={{ textAlign: 'center', color: '#64748b', fontSize: '1.2rem', marginBottom: '1rem' }}>Sus turnos actuales:</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {turnosEnEspera.map(turno => (
              <div key={turno.id} style={{ background: 'radial-gradient(circle at top right, #f0f9ff 0%, #e0f2fe 100%)', padding: '20px', borderRadius: '15px', border: '1px solid #bae6fd', boxShadow: '0 10px 15px -3px rgba(2, 132, 199, 0.1)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px 0', color: '#0369a1', fontSize: '1.1rem', fontWeight: 'bold' }}>{turno.sala}</p>
                <div style={{ fontSize: '4.5rem', fontWeight: 'bold', color: '#0284c7', letterSpacing: '3px' }}>{turno.numero}</div>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '25px', height: '25px', border: '3px solid #bae6fd', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            ))}
          </div>

          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

          <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '1rem', color: '#334155', marginTop: 0, marginBottom: '1rem' }}>¿Quiere asegurarse de que le avisaremos?</h3>
            <button onClick={probarNotificacion} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}>
              🔔 Probar alerta
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', color: '#0f172a', marginBottom: '1.5rem', fontSize: '1.3rem' }}>
          {turnosEnEspera.length > 0 ? '¿Necesita cita para otra consulta?' : 'Seleccione la consulta:'}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {salas.map(sala => {
            const yaTieneTurno = misTurnos.some(t => t.cola_id === sala.id) 
            
            return (
              <button 
                key={sala.id} 
                onClick={() => pedirTurno(sala)} 
                disabled={cargando || yaTieneTurno} 
                style={{ 
                  padding: '20px', 
                  backgroundColor: yaTieneTurno ? '#f8fafc' : 'rgba(255, 255, 255, 0.9)', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  fontSize: '1.3rem', 
                  fontWeight: 'bold', 
                  color: yaTieneTurno ? '#94a3b8' : '#334155', 
                  cursor: (cargando || yaTieneTurno) ? 'not-allowed' : 'pointer', 
                  boxShadow: yaTieneTurno ? 'none' : '0 10px 15px -3px rgba(0,0,0,0.05)', 
                  transition: 'transform 0.1s',
                  opacity: yaTieneTurno ? 0.7 : 1,
                  backdropFilter: 'blur(4px)' // Un ligero difuminado detrás del botón para que resalte más sobre el fondo
                }}
              >
                {sala.nombre}
                {yaTieneTurno && (
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#ef4444', marginTop: '8px', fontWeight: 'normal' }}>
                    Turno ya solicitado
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}