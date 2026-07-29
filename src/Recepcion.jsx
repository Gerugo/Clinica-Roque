import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

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
  const [misTurnos, setMisTurnos] = useState([]) // NUEVO: Ahora guardamos un ARRAY de turnos
  const [cargando, setCargando] = useState(false)

  // 1. Carga inicial de datos y recuperación de turnos guardados (localStorage)
  useEffect(() => {
    const obtenerDatos = async () => {
      // Cargar salas
      const { data: salasData } = await supabase.from('colas').select('*').eq('activa', true).order('nombre', { ascending: true })
      if (salasData) setSalas(salasData)

      // Cargar turnos del localStorage y verificar su estado real en la Base de Datos
      const turnosGuardados = JSON.parse(localStorage.getItem('turnos_paciente') || '[]')
      if (turnosGuardados.length > 0) {
        const ids = turnosGuardados.map(t => t.id)
        const { data: turnosBD } = await supabase.from('turnos').select('id, estado').in('id', ids)
        
        if (turnosBD) {
          // Filtramos para mantener solo los que siguen en espera o llamados (eliminamos los descartados/finalizados)
          const turnosValidos = turnosGuardados.filter(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return dbT && (dbT.estado === 'espera' || dbT.estado === 'llamado')
          }).map(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return { ...t, estado: dbT.estado } // Actualizamos el estado real
          })
          setMisTurnos(turnosValidos)
        } else {
          setMisTurnos(turnosGuardados)
        }
      }
    }
    obtenerDatos()
  }, [])

  // 2. Guardar en localStorage cada vez que la lista de turnos cambia
  useEffect(() => {
    localStorage.setItem('turnos_paciente', JSON.stringify(misTurnos))
  }, [misTurnos])

  // 3. Suscripción Realtime para actualizar CUALQUIERA de los turnos del paciente
  useEffect(() => {
    if (misTurnos.length === 0) return

    const canalPaciente = supabase
      .channel('paciente-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'turnos' }, (payload) => {
        const turnoActualizado = payload.new
        
        setMisTurnos(prevTurnos => {
          const index = prevTurnos.findIndex(t => t.id === turnoActualizado.id)
          if (index === -1) return prevTurnos // Si no es nuestro turno, lo ignoramos

          // Si el médico descarta el turno, lo borramos de la pantalla del paciente
          if (turnoActualizado.estado === 'descartado') {
            return prevTurnos.filter(t => t.id !== turnoActualizado.id)
          }

          const nuevosTurnos = [...prevTurnos]
          nuevosTurnos[index] = { ...nuevosTurnos[index], estado: turnoActualizado.estado }
          
          // Vibrar si nos llaman (Solo si antes estábamos en espera)
          if (turnoActualizado.estado === 'llamado' && prevTurnos[index].estado !== 'llamado') {
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300])
          }
          
          return nuevosTurnos
        })
      })
      .subscribe()

    return () => supabase.removeChannel(canalPaciente)
  }, [misTurnos.length]) // Nos suscribimos basándonos en la cantidad de turnos

  // 4. Wake Lock API: Mantiene la pantalla encendida si hay algún turno en espera
  useEffect(() => {
    let wakeLock = null;
    const solicitarPantallaEncendida = async () => {
      try {
        const hayEspera = misTurnos.some(t => t.estado === 'espera')
        if ('wakeLock' in navigator && hayEspera) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log(`Wake Lock no activo: ${err.message}`);
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
    // PROTECCIÓN EXTRA: Por si el botón no se deshabilitó correctamente
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
      setMisTurnos([...misTurnos, nuevoTurno]) // Añadimos el nuevo turno al array
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

  // PANTALLA 1: TURNO LLAMADO (Tiene prioridad absoluta y ocupa toda la pantalla)
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
        
        {/* Al finalizar, solo borramos ESTE turno en concreto del array */}
        <button onClick={() => setMisTurnos(prev => prev.filter(t => t.id !== turnoLlamado.id))} style={{ marginTop: '4rem', padding: '15px 30px', fontSize: '1.2rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.5)', color: 'white', borderRadius: '10px', cursor: 'pointer', transition: 'background-color 0.3s' }}>
          Entendido / Finalizar
        </button>
      </div>
    )
  }

  // PANTALLA 2: DASHBOARD DEL PACIENTE (Combina Espera + Selección)
  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(to bottom right, #ffffff 0%, #f1f5f9 100%)', minHeight: '100vh' }}>
      
      <header style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
        <h1 style={{ color: '#0f172a', fontSize: '2rem', margin: '0 0 5px 0' }}>Clínica Roque</h1>
      </header>

      {/* SECCIÓN A: TURNOS ACTIVOS (Solo se muestra si el paciente tiene turnos pedidos) */}
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

          {/* Bloque de prueba de notificación */}
          <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '1rem', color: '#334155', marginTop: 0, marginBottom: '1rem' }}>¿Quiere asegurarse de que le avisaremos?</h3>
            <button onClick={probarNotificacion} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}>
              🔔 Probar alerta
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN B: PEDIR NUEVO TURNO */}
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', color: '#0f172a', marginBottom: '1.5rem', fontSize: '1.3rem' }}>
          {turnosEnEspera.length > 0 ? '¿Necesita cita para otra consulta?' : 'Seleccione la consulta:'}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {salas.map(sala => {
            const yaTieneTurno = misTurnos.some(t => t.cola_id === sala.id) // Verifica si ya está en esta cola
            
            return (
              <button 
                key={sala.id} 
                onClick={() => pedirTurno(sala)} 
                disabled={cargando || yaTieneTurno} 
                style={{ 
                  padding: '20px', 
                  backgroundColor: yaTieneTurno ? '#f8fafc' : '#fff', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  fontSize: '1.3rem', 
                  fontWeight: 'bold', 
                  color: yaTieneTurno ? '#94a3b8' : '#334155', 
                  cursor: (cargando || yaTieneTurno) ? 'not-allowed' : 'pointer', 
                  boxShadow: yaTieneTurno ? 'none' : '0 10px 15px -3px rgba(0,0,0,0.05)', 
                  transition: 'transform 0.1s',
                  opacity: yaTieneTurno ? 0.7 : 1
                }}
              >
                {sala.nombre}
                {/* Mensaje rojo si ya ha pulsado este botón */}
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