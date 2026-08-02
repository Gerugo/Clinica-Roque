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

  const reproducirSonidoMovil = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, audioCtx.currentTime)
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.5)
    } catch (e) {
      console.log('Audio no soportado en este navegador')
    }
  }

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

  useEffect(() => {
    localStorage.setItem('turnos_paciente', JSON.stringify(misTurnos))
  }, [misTurnos])

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
          
          if (turnoActualizado.estado === 'llamado' && prevTurnos[index].estado !== 'llamado') {
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300])
            reproducirSonidoMovil()
          }
          
          nuevosTurnos[index] = { ...nuevosTurnos[index], estado: turnoActualizado.estado }
          return nuevosTurnos
        })
      })
      .subscribe()

    return () => supabase.removeChannel(canalPaciente)
  }, []) 

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

  const turnoLlamado = misTurnos.find(t => t.estado === 'llamado')
  const turnosEnEspera = misTurnos.filter(t => t.estado === 'espera')

  // ESTILOS COMPARTIDOS DEL FONDO PREMIUM
  const fondoPremiumStyles = {
    padding: '1.5rem',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '100vh',
    backgroundImage: `linear-gradient(rgba(26, 30, 36, 0.85), rgba(26, 30, 36, 0.95)), url('/1785611890284.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    color: '#f3f4f6'
  }

  // PANTALLA 1: TURNO LLAMADO (Adaptada al nuevo diseño)
  if (turnoLlamado) {
    return (
      <div style={{ ...fondoPremiumStyles, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <style>{`@keyframes latidoOro { 0% { opacity: 1; transform: scale(1); text-shadow: 0 0 20px rgba(197, 160, 89, 0.3); } 50% { opacity: 0.9; transform: scale(1.05); text-shadow: 0 0 40px rgba(197, 160, 89, 0.6); } 100% { opacity: 1; transform: scale(1); text-shadow: 0 0 20px rgba(197, 160, 89, 0.3); } }`}</style>
        <div style={{ animation: 'latidoOro 1.5s infinite', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0', color: '#c5a059', letterSpacing: '4px', fontWeight: '300' }}>¡ES SU TURNO!</h1>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'normal', margin: '0 0 2rem 0', color: '#8b9a7b' }}>Diríjase a:</h2>
          
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'rgba(197, 160, 89, 0.1)', border: '1px solid rgba(197, 160, 89, 0.3)', color: '#c5a059', padding: '20px 40px', borderRadius: '20px', marginBottom: '2rem', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' }}>
            {turnoLlamado.sala}
          </div>
          
          <div style={{ fontSize: '1.2rem', opacity: '0.9', color: '#e5e7eb' }}>
            Su código era: <span style={{fontWeight: 'bold', color: '#c5a059'}}>{turnoLlamado.numero}</span>
          </div>
        </div>
        
        <button onClick={() => setMisTurnos(prev => prev.filter(t => t.id !== turnoLlamado.id))} style={{ marginTop: '4rem', padding: '15px 40px', fontSize: '1.1rem', background: 'transparent', border: '1px solid #8b9a7b', color: '#8b9a7b', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s', fontWeight: 'bold' }}>
          Entendido / Finalizar
        </button>
      </div>
    )
  }

  // PANTALLA 2: DASHBOARD DEL PACIENTE
  return (
    <div style={fondoPremiumStyles}>
      
      {/* CABECERA */}
      <header style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="/pwa-192x192.png" 
          alt="Logo Clínica Roque" 
          style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', border: '1px solid rgba(197, 160, 89, 0.2)' }} 
        />
      </header>

      <InstallButton />

      {turnosEnEspera.length > 0 && (
        <div style={{ marginBottom: '3rem', maxWidth: '400px', margin: '0 auto 3rem auto' }}>
          <h2 style={{ textAlign: 'center', color: '#8b9a7b', fontSize: '1rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>Sus turnos actuales:</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {turnosEnEspera.map(turno => (
              <div key={turno.id} style={{ background: 'rgba(30, 35, 42, 0.55)', backdropFilter: 'blur(12px)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(197, 160, 89, 0.25)', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px 0', color: '#e5e7eb', fontSize: '1.1rem', fontWeight: '400' }}>{turno.sala}</p>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#c5a059', letterSpacing: '3px', textShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>{turno.numero}</div>
                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '25px', height: '25px', border: '3px solid rgba(139, 154, 123, 0.3)', borderTop: '3px solid #c5a059', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            ))}
          </div>

          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

          {/* TARJETA PRUEBA DE ALERTA PREMIUM */}
          <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(26, 30, 36, 0.7)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: 0, marginBottom: '1rem', fontWeight: 'normal' }}>¿Quiere asegurarse de que le avisaremos?</h3>
            <button onClick={probarNotificacion} style={{ padding: '10px 20px', background: 'rgba(197, 160, 89, 0.1)', color: '#c5a059', border: '1px solid #c5a059', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>
              🔔 Probar alerta sonora
            </button>
          </div>
        </div>
      )}

      {/* BOTONERA DE SELECCIÓN DE SALAS */}
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', color: '#e5e7eb', marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '300' }}>
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
                  background: yaTieneTurno ? 'rgba(30, 35, 42, 0.3)' : 'rgba(30, 35, 42, 0.7)', 
                  border: yaTieneTurno ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(139, 154, 123, 0.4)', 
                  borderRadius: '12px', 
                  fontSize: '1.2rem', 
                  fontWeight: 'normal', 
                  color: yaTieneTurno ? '#6b7280' : '#f3f4f6', 
                  cursor: (cargando || yaTieneTurno) ? 'not-allowed' : 'pointer', 
                  boxShadow: yaTieneTurno ? 'none' : '0 8px 20px rgba(0,0,0,0.3)', 
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(8px)'
                }}
              >
                {sala.nombre}
                {yaTieneTurno && (
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#c5a059', marginTop: '8px', fontWeight: 'normal' }}>
                    Turno activo
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
