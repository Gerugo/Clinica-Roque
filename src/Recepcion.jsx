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
  const [cargando, setCargando] = useState(false)
  
  // SOLUCIÓN AL BORRADO: Inicializar leyendo directamente de localStorage
  const [misTurnos, setMisTurnos] = useState(() => {
    try {
      const guardados = localStorage.getItem('turnos_paciente');
      return guardados ? JSON.parse(guardados) : [];
    } catch (e) {
      return [];
    }
  }) 

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
      console.log('Audio no soportado')
    }
  }

  // 1. Carga inicial: Sincronizar el estado real de los turnos con la base de datos
  useEffect(() => {
    const inicializarDatos = async () => {
      // Cargar salas
      const { data: salasData } = await supabase.from('colas').select('*').eq('activa', true).order('nombre', { ascending: true })
      if (salasData) setSalas(salasData)

      // Actualizar el estado de los turnos que ya teníamos en memoria
      if (misTurnos.length > 0) {
        const ids = misTurnos.map(t => t.id)
        const { data: turnosBD } = await supabase.from('turnos').select('id, estado').in('id', ids)
        
        if (turnosBD) {
          const turnosValidos = misTurnos.filter(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return dbT && (dbT.estado === 'espera' || dbT.estado === 'llamado')
          }).map(t => {
            const dbT = turnosBD.find(db => db.id === t.id)
            return { ...t, estado: dbT.estado } 
          })
          setMisTurnos(turnosValidos)
        }
      }
    }
    inicializarDatos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo se ejecuta al montar

  // 2. Guardar en localStorage de forma segura
  useEffect(() => {
    localStorage.setItem('turnos_paciente', JSON.stringify(misTurnos))
  }, [misTurnos])

  // 3. Suscripción Realtime (Igual, funciona perfecto)
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
      } catch (err) {}
    };
    solicitarPantallaEncendida();
    return () => { if (wakeLock !== null) wakeLock.release(); };
  }, [misTurnos]);

  const generarCodigo = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 3; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    return codigo
  }

  // =========================================================
  // EL ANTÍDOTO: DESTRUCCIÓN DE SUSCRIPCIONES ZOMBI
  // =========================================================
  const obtenerSuscripcionPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn("Navegador no compatible con Push");
      return null;
    }
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        console.warn("El paciente denegó las notificaciones");
        return null;
      }
      
      const registro = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      
      // 1. Buscar y destruir cualquier suscripción zombi anterior
      const suscripcionExistente = await registro.pushManager.getSubscription();
      if (suscripcionExistente) {
        console.log("Destruyendo suscripción antigua...");
        await suscripcionExistente.unsubscribe();
      }

      // 2. Crear una suscripción totalmente fresca y limpia
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

    // AVISO VISUAL SI FALLA LA SUSCRIPCIÓN
    if (!datosPush) {
      alert("⚠️ No se han podido activar las notificaciones en 2º plano. Por favor, no bloquee la pantalla para no perder su turno.");
    }

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

  // NUEVOS ESTILOS: DISEÑO MÉDICO CLARO (Estilo QRQ)
  const fondoAppStyles = {
    padding: '1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#f8fafc', // Gris muy clarito
    backgroundImage: 'radial-gradient(circle at top right, #e0f2fe 0%, #f8fafc 40%, #f1f5f9 100%)',
    color: '#0f172a'
  }

  // PANTALLA 1: TURNO LLAMADO (Aviso en verde vibrante)
  if (turnoLlamado) {
    return (
      <div style={{ ...fondoAppStyles, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ecfdf5', backgroundImage: 'none' }}>
        <style>{`@keyframes latido { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }`}</style>
        
        <div style={{ animation: 'latido 1.5s infinite', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0', color: '#059669', fontWeight: '800' }}>¡ES SU TURNO!</h1>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'normal', margin: '0 0 2rem 0', color: '#475569' }}>Diríjase a:</h2>
          
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'white', border: '2px solid #34d399', color: '#047857', padding: '20px 40px', borderRadius: '20px', marginBottom: '2rem', boxShadow: '0 10px 25px rgba(5, 150, 105, 0.2)' }}>
            {turnoLlamado.sala}
          </div>
          
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>
            Su código era: <span style={{fontWeight: 'bold', color: '#0f172a'}}>{turnoLlamado.numero}</span>
          </div>
        </div>
        
        <button onClick={() => setMisTurnos(prev => prev.filter(t => t.id !== turnoLlamado.id))} style={{ marginTop: '4rem', padding: '15px 40px', fontSize: '1.1rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', fontWeight: 'bold' }}>
          Entendido / Finalizar
        </button>
      </div>
    )
  }

  // PANTALLA 2: DASHBOARD DEL PACIENTE (Modo Claro)
  return (
    <div style={fondoAppStyles}>
      
      {/* CABECERA: Ahora sobre fondo claro resalta perfectamente */}
      <header style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="/pwa-192x192.png" 
          alt="Logo Clínica Roque" 
          style={{ width: '100px', height: '100px', objectFit: 'contain', borderRadius: '20px', backgroundColor: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', padding: '5px' }} 
        />
      </header>

      <InstallButton />

      {turnosEnEspera.length > 0 && (
        <div style={{ marginBottom: '3rem', maxWidth: '400px', margin: '0 auto 3rem auto' }}>
          <h2 style={{ textAlign: 'center', color: '#64748b', fontSize: '1rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Sus turnos actuales:</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {turnosEnEspera.map(turno => (
              <div key={turno.id} style={{ background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', textAlign: 'center' }}>
                <p style={{ margin: '0 0 5px 0', color: '#475569', fontSize: '1.1rem' }}>{turno.sala}</p>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#0284c7', letterSpacing: '2px' }}>{turno.numero}</div>
                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '25px', height: '25px', border: '3px solid #e0f2fe', borderTop: '3px solid #0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            ))}
          </div>

          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* BOTONERA DE SELECCIÓN DE SALAS */}
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', color: '#334155', marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>
          {turnosEnEspera.length > 0 ? '¿Necesita otra consulta?' : 'Seleccione la consulta:'}
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
                  background: yaTieneTurno ? '#f8fafc' : '#ffffff', 
                  border: '1px solid',
                  borderColor: yaTieneTurno ? '#e2e8f0' : '#cbd5e1', 
                  borderRadius: '16px', 
                  fontSize: '1.2rem', 
                  fontWeight: '600', 
                  color: yaTieneTurno ? '#94a3b8' : '#1e293b', 
                  cursor: (cargando || yaTieneTurno) ? 'not-allowed' : 'pointer', 
                  boxShadow: yaTieneTurno ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)', 
                  transition: 'all 0.2s',
                }}
              >
                {sala.nombre}
                {yaTieneTurno && (
                  <span style={{ display: 'block', fontSize: '0.85rem', color: '#0284c7', marginTop: '8px', fontWeight: 'normal' }}>
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
