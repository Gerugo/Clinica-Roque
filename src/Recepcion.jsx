import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

// Tu Clave Pública de VAPID Keys
const PUBLIC_VAPID_KEY = 'BLwFdwnK3Qh0TUVGdSu0uSIJltf6pMpybCqagPIzWiTL4ZSlQjgeUnIFlqXHM3vnCemBDcCgmd_uTICoNhIN2gQ';

// Función auxiliar necesaria para convertir la clave VAPID al formato que exige el navegador
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
  const [miTurno, setMiTurno] = useState(null)
  const [estadoTurno, setEstadoTurno] = useState('espera')
  const [cargando, setCargando] = useState(false)

  // Cargar salas al iniciar
  useEffect(() => {
    const obtenerSalas = async () => {
      const { data } = await supabase.from('colas').select('*').eq('activa', true).order('nombre', { ascending: true })
      if (data) setSalas(data)
    }
    obtenerSalas()
  }, [])

  // Suscripción Realtime por si el paciente mantiene la pantalla abierta
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

  // Wake Lock API para mantener la pantalla encendida automáticamente
  useEffect(() => {
    let wakeLock = null;
    const solicitarPantallaEncendida = async () => {
      try {
        if ('wakeLock' in navigator && estadoTurno === 'espera') {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log(`Wake Lock no activo: ${err.message}`);
      }
    };

    if (estadoTurno === 'espera') solicitarPantallaEncendida();

    return () => {
      if (wakeLock !== null) wakeLock.release();
    };
  }, [estadoTurno]);

  const generarCodigo = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 3; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    return codigo
  }

  // Registra el Service Worker y crea el ticket de notificación
  const obtenerSuscripcionPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Las notificaciones Push no son soportadas en este navegador.');
      return null;
    }

    try {
      // 1. Pedir permiso al usuario
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        console.log('Permiso de notificaciones denegado por el paciente.');
        return null;
      }

      // 2. Registrar Service Worker
      const registro = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Suscribir al servidor de Push usando tu Clave Pública
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      return suscripcion.toJSON();
    } catch (error) {
      console.error('Error al configurar Web Push:', error);
      return null;
    }
  }

  const pedirTurno = async (sala) => {
    setCargando(true)
    const nuevoCodigo = generarCodigo()
    
    // Intentamos obtener los datos de push (si el usuario acepta)
    const datosPush = await obtenerSuscripcionPush();

    // Guardamos en Supabase el turno junto con el ticket de notificaciones
    const { data, error } = await supabase
      .from('turnos')
      .insert([{ 
        cola_id: sala.id, 
        numero: nuevoCodigo, 
        estado: 'espera',
        suscripcion_push: datosPush 
      }])
      .select()

    if (!error && data && data.length > 0) {
      setMiTurno({ id: data[0].id, numero: nuevoCodigo, sala: sala.nombre })
      setEstadoTurno('espera')
    } else {
      alert('Error al solicitar el turno.')
    }
    setCargando(false)
  }

  // PANTALLA: TURNO LLAMADO
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

  // PANTALLA: EN ESPERA
  if (miTurno && estadoTurno === 'espera') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ color: '#64748b', fontSize: '1.5rem' }}>Su turno para {miTurno.sala} es:</h2>
        <div style={{ fontSize: '6rem', fontWeight: 'bold', color: '#0ea5e9', margin: '2rem 0', letterSpacing: '5px' }}>{miTurno.numero}</div>
        
        <div style={{ backgroundColor: '#e0f2fe', padding: '15px', borderRadius: '10px', marginBottom: '2rem' }}>
          <p style={{ color: '#0284c7', fontSize: '1.1rem', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            🔔 Notificaciones activadas
          </p>
          <p style={{ color: '#0369a1', fontSize: '1rem', margin: 0 }}>
            Puede bloquear su teléfono si lo desea. Le enviaremos un aviso cuando el médico le llame.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
           <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTop: '4px solid #0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // PANTALLA: SELECCIÓN DE SALA
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