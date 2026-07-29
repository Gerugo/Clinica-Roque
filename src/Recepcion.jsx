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

  // NUEVA FUNCIÓN: Dispara una notificación local de prueba
  const probarNotificacion = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Su dispositivo o navegador no soporta notificaciones web.');
      return;
    }

    if (Notification.permission !== 'granted') {
      alert('Debe permitir las notificaciones al navegador para poder recibir el aviso.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('🔔 Prueba de aviso', {
        body: 'Si su móvil ha vibrado y sonado, ¡todo está configurado correctamente!',
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true,
        tag: 'prueba-alerta'
      });
    } catch (error) {
      console.error('Error al lanzar la prueba:', error);
    }
  };


  // PANTALLA: TURNO LLAMADO
  if (miTurno && estadoTurno === 'llamado') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <style>{`@keyframes parpadeo { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }`}</style>
        <div style={{ animation: 'parpadeo 1s infinite' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 1rem 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>¡ES SU TURNO!</h1>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'normal', margin: '0 0 2rem 0' }}>Diríjase a:</h2>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', backgroundColor: 'white', color: '#064e3b', padding: '15px 30px', borderRadius: '15px', marginBottom: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>{miTurno.sala}</div>
          <div style={{ fontSize: '1.5rem', opacity: '0.9' }}>Su código era: <span style={{fontWeight: 'bold'}}>{miTurno.numero}</span></div>
        </div>
        <button onClick={() => { setMiTurno(null); setEstadoTurno('espera'); }} style={{ marginTop: '4rem', padding: '15px 30px', fontSize: '1.2rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.5)', color: 'white', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.3s' }}>
          Finalizar
        </button>
      </div>
    )
  }

  // PANTALLA: EN ESPERA
  if (miTurno && estadoTurno === 'espera') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: 'radial-gradient(circle at top right, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ color: '#64748b', fontSize: '1.5rem' }}>Su turno para {miTurno.sala} es:</h2>
        <div style={{ fontSize: '6rem', fontWeight: 'bold', color: '#0284c7', margin: '2rem 0', letterSpacing: '5px', textShadow: '0 4px 6px rgba(2, 132, 199, 0.1)' }}>{miTurno.numero}</div>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <p style={{ color: '#0284c7', fontSize: '1.1rem', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            🔔 Notificaciones activadas
          </p>
          <p style={{ color: '#0369a1', fontSize: '1rem', margin: 0 }}>
            Puede bloquear su teléfono si lo desea. Le enviaremos un aviso cuando el médico le llame.
          </p>
        </div>

        {/* BLOQUE: Botón de prueba de alerta */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#334155', marginTop: 0, marginBottom: '1rem' }}>
            ¿Quiere asegurarse de que le avisaremos?
          </h3>
          <button 
            onClick={probarNotificacion}
            style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)' }}
          >
            <span>🔔</span> Probar alerta
          </button>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1rem', marginBottom: 0, lineHeight: '1.4' }}>
            Pulse el botón y bloquee la pantalla. Si no escucha sonido ni vibración, revise que su teléfono no esté en modo <b>Silencio</b> o verifique los permisos de su navegador (En iPhone recuerde "Añadir a la pantalla de inicio").
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
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(to bottom right, #ffffff 0%, #f1f5f9 100%)', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '2rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: '0 0 10px 0' }}>Bienvenido a Clínica Roque</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Seleccione la consulta a la que desea acudir:</p>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '0 auto' }}>
        {salas.map(sala => (
          <button key={sala.id} onClick={() => pedirTurno(sala)} disabled={cargando} style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', color: '#334155', cursor: cargando ? 'wait' : 'pointer', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)', transition: 'transform 0.1s' }}>
            {sala.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}