import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

// Función auxiliar para generar el código alfanumérico
const generarCodigo = () => {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 3; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
  return codigo
}

export default function Admin() {
  // Estado de Seguridad
  const [autenticado, setAutenticado] = useState(false)
  const [pin, setPin] = useState('')

  // Estados de la Aplicación
  const [colas, setColas] = useState([])
  const [turnoActual, setTurnoActual] = useState({}) 
  const [esperaPorSala, setEsperaPorSala] = useState({}) 
  const [nuevaConsulta, setNuevaConsulta] = useState('')
  const [creandoCola, setCreandoCola] = useState(false)
  const [cargandoCola, setCargandoCola] = useState(null)

  // Carga inicial de datos
  useEffect(() => {
    if (!autenticado) return

    const cargarDatos = async () => {
      const { data: colasData, error: colasError } = await supabase
        .from('colas')
        .select('*')
        .eq('activa', true)
        .order('id', { ascending: true })
      
      if (colasError || !colasData) return
      setColas(colasData)

      const promesas = colasData.map(async (sala) => {
        const { data: dataLlamado } = await supabase
          .from('turnos')
          .select('*')
          .eq('cola_id', sala.id)
          .eq('estado', 'llamado')
          .order('updated_at', { ascending: false })
          .limit(1)

        const { count: countEspera } = await supabase
          .from('turnos')
          .select('*', { count: 'exact', head: true })
          .eq('cola_id', sala.id)
          .eq('estado', 'espera')

        return {
          salaId: sala.id,
          ultimoTurno: dataLlamado && dataLlamado.length > 0 ? dataLlamado[0] : null,
          espera: countEspera || 0
        }
      })

      const resultados = await Promise.all(promesas)
      
      const turnosIniciales = {}
      const esperasIniciales = {}
      
      resultados.forEach(res => {
        turnosIniciales[res.salaId] = res.ultimoTurno
        esperasIniciales[res.salaId] = res.espera
      })
      
      setTurnoActual(turnosIniciales)
      setEsperaPorSala(esperasIniciales)
    }

    cargarDatos()

    const canalAdmin = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'turnos' }, (payload) => {
        if (payload.new.estado === 'espera') {
          setEsperaPorSala(prev => ({
            ...prev,
            [payload.new.cola_id]: (prev[payload.new.cola_id] || 0) + 1
          }))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(canalAdmin)
  }, [autenticado])

  // Lógica de Seguridad
  const verificarPin = (e) => {
    e.preventDefault()
    if (pin === '1234') { 
      setAutenticado(true)
    } else {
      alert('PIN incorrecto. Acceso denegado.')
      setPin('')
    }
  }

  const crearNuevaConsulta = async () => {
    if (!nuevaConsulta.trim()) return
    setCreandoCola(true)
    const { data, error } = await supabase.from('colas').insert([{ nombre: nuevaConsulta.trim(), activa: true }]).select()
    if (!error && data && data.length > 0) {
      setColas([...colas, data[0]])
      setNuevaConsulta('')
    } else {
      alert('Hubo un error al crear la sala.')
    }
    setCreandoCola(false)
  }

  const eliminarCola = async (salaId, nombreSala) => {
    const confirmacion = window.confirm(`¿Estás seguro de que quieres eliminar la sala "${nombreSala}"?`)
    if (!confirmacion) return
    const { error } = await supabase.from('colas').update({ activa: false }).eq('id', salaId)
    if (!error) setColas(colas.filter(c => c.id !== salaId))
  }

  // =========================================================
  // NUEVO: Generar Turno Manual e Imprimir Ticket
  // =========================================================
  const imprimirTicket = (salaNombre, numero) => {
    const fecha = new Date().toLocaleDateString('es-ES')
    const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    
    // Abrimos una ventana oculta para la impresión
    const ventanaImpresion = window.open('', '_blank', 'width=400,height=600');
    
    // Inyectamos HTML optimizado para impresoras térmicas
    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Ticket Clínica Roque</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; text-align: center; color: #000; margin: 0; padding: 20px; }
            .ticket-container { max-width: 300px; margin: 0 auto; }
            h1 { font-size: 1.5rem; margin-bottom: 5px; text-transform: uppercase; }
            h2 { font-size: 1.2rem; margin-top: 0; font-weight: normal; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .numero-box { margin: 20px 0; padding: 10px 0; border-top: 2px dashed #000; border-bottom: 2px dashed #000; }
            .numero { font-size: 4.5rem; font-weight: bold; margin: 0; letter-spacing: 2px; line-height: 1; }
            p { font-size: 0.9rem; margin: 5px 0; }
            .footer { margin-top: 20px; font-size: 0.8rem; border-top: 1px solid #000; padding-top: 10px; }
            @media print {
              @page { margin: 0; }
              body { margin: 0.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <h1>Clínica Roque</h1>
            <h2>${salaNombre}</h2>
            <div class="numero-box">
              <p>SU TURNO ES:</p>
              <div class="numero">${numero}</div>
            </div>
            <p>Por favor, tome asiento.</p>
            <p>Le avisaremos por las pantallas.</p>
            <div class="footer">
              Fecha: ${fecha} - Hora: ${hora}
            </div>
          </div>
          <script>
            // Lanza la impresión y cierra la ventana al terminar
            window.onload = function() { 
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    ventanaImpresion.document.close();
  }

  const generarTurnoManual = async (salaId, salaNombre) => {
    setCargandoCola(salaId)
    const nuevoCodigo = generarCodigo()
    
    // Insertamos el turno sin suscripción push (es un paciente de sala de espera)
    const { error } = await supabase
      .from('turnos')
      .insert([{ 
        cola_id: salaId, 
        numero: nuevoCodigo, 
        estado: 'espera',
        suscripcion_push: null 
      }])

    if (!error) {
      imprimirTicket(salaNombre, nuevoCodigo)
    } else {
      alert('Error al generar el turno manual en la base de datos.')
    }
    setCargandoCola(null)
  }

  const dispararPush = async (suscripcion, nombreSala, numero) => {
    try {
      await supabase.functions.invoke('enviar-alerta', {
        body: { suscripcion: suscripcion, sala: nombreSala, numero: numero }
      })
    } catch (error) {
      console.error("Error al enviar la notificación Push:", error)
    }
  }

  const llamarSiguiente = async (salaId) => {
    setCargandoCola(salaId)
    
    const { data: turnosEspera, error: errorBusqueda } = await supabase
      .from('turnos').select('*').eq('cola_id', salaId).eq('estado', 'espera')
      .order('created_at', { ascending: true }).limit(1)

    if (errorBusqueda) {
      alert('Error de conexión.')
      setCargandoCola(null); return
    }
    if (!turnosEspera || turnosEspera.length === 0) {
      alert('No hay pacientes en la sala de espera para esta consulta.')
      setCargandoCola(null); return
    }

    const turnoALlamar = turnosEspera[0]
    const { error: errorUpdate } = await supabase
      .from('turnos').update({ estado: 'llamado' }).eq('id', turnoALlamar.id)

    if (!errorUpdate) {
      setTurnoActual(prev => ({ ...prev, [salaId]: turnoALlamar }))
      setEsperaPorSala(prev => ({ ...prev, [salaId]: Math.max(0, (prev[salaId] || 1) - 1) }))
      
      if (turnoALlamar.suscripcion_push) {
        const sala = colas.find(c => c.id === salaId)
        dispararPush(turnoALlamar.suscripcion_push, sala.nombre, turnoALlamar.numero)
      }
    } else {
      alert('Error al llamar al paciente.')
    }
    setCargandoCola(null)
  }

  const reLlamar = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return
    setCargandoCola(salaId)
    
    await supabase.from('turnos').update({ estado: 'llamado' }).eq('id', turno.id)
    
    if (turno.suscripcion_push) {
      const sala = colas.find(c => c.id === salaId)
      dispararPush(turno.suscripcion_push, sala.nombre, turno.numero)
    }
    setCargandoCola(null)
  }

  const descartarTurno = async (salaId) => {
    const turno = turnoActual[salaId]
    if (!turno) return
    
    const confirmacion = window.confirm(`¿Descartar el turno ${turno.numero}? Desaparecerá de la pantalla.`)
    if (!confirmacion) return

    setCargandoCola(salaId)
    await supabase.from('turnos').update({ estado: 'descartado' }).eq('id', turno.id)
    setTurnoActual(prev => ({ ...prev, [salaId]: null }))
    setCargandoCola(null)
  }

  // -----------------------------------------------------
  // VISTA 1: PANTALLA DE LOGIN / PIN
  // -----------------------------------------------------
  if (!autenticado) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)', fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={verificarPin} style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', padding: '4rem 3rem', borderRadius: '24px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
          <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem' }}>🩺</span></div>
          <h2 style={{ color: '#f8fafc', marginBottom: '2.5rem', fontWeight: '500', letterSpacing: '1px' }}>Acceso Médico</h2>
          <input 
            type="password" placeholder="****" value={pin} onChange={(e) => setPin(e.target.value)}
            style={{ padding: '15px', fontSize: '2rem', width: '220px', textAlign: 'center', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: 'white', marginBottom: '2.5rem', letterSpacing: '8px', outline: 'none', transition: 'border-color 0.3s' }}
            onFocus={(e) => e.target.style.borderColor = '#38bdf8'} onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} autoFocus
          />
          <br />
          <button type="submit" style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)', transition: 'transform 0.1s' }} onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'} onMouseUp={(e) => e.target.style.transform = 'scale(1)'}>
            Entrar al Panel
          </button>
        </form>
      </div>
    )
  }

  // -----------------------------------------------------
  // VISTA 2: DASHBOARD PRINCIPAL (MODO OSCURO)
  // -----------------------------------------------------
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', background: '#0f172a', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <h1 style={{ color: '#f8fafc', fontSize: '2.5rem', margin: '0 0 10px 0', fontWeight: '800' }}>Panel de Administración</h1>
        <p style={{ color: '#94a3b8', fontSize: '1.2rem', margin: 0, fontWeight: '500' }}>Gestión avanzada de salas y turnos</p>
      </header>

      {/* Creador de Salas */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '4rem', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '16px', maxWidth: '700px', margin: '0 auto 4rem auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', border: '1px solid #334155' }}>
        <input 
          type="text" placeholder="Nombre de la nueva sala (Ej: Consulta 3)..." value={nuevaConsulta} onChange={(e) => setNuevaConsulta(e.target.value)}
          style={{ flex: 1, padding: '15px 20px', fontSize: '1.1rem', borderRadius: '10px', border: '1px solid #475569', outline: 'none', transition: 'border-color 0.2s', backgroundColor: '#0f172a', color: '#e2e8f0' }}
          onFocus={(e) => e.target.style.borderColor = '#38bdf8'} onBlur={(e) => e.target.style.borderColor = '#475569'}
        />
        <button 
          onClick={crearNuevaConsulta} disabled={creandoCola || !nuevaConsulta.trim()}
          style={{ padding: '15px 30px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: (creandoCola || !nuevaConsulta.trim()) ? '#334155' : '#38bdf8', color: (creandoCola || !nuevaConsulta.trim()) ? '#64748b' : '#0f172a', border: 'none', borderRadius: '10px', cursor: (creandoCola || !nuevaConsulta.trim()) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
        >
          {creandoCola ? 'Creando...' : '+ Añadir Sala'}
        </button>
      </div>

      {/* Cuadrícula de Consultas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {colas.map(sala => {
          const estaCargando = cargandoCola === sala.id
          const turno = turnoActual[sala.id]
          const enEspera = esperaPorSala[sala.id] || 0
          
          return (
            <div key={sala.id} style={{ backgroundColor: '#1e293b', borderRadius: '20px', padding: '2rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: enEspera > 0 ? 'linear-gradient(90deg, #38bdf8, #34d399)' : '#475569' }} />

              {/* Cabecera */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #334155' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#f8fafc', margin: 0, fontWeight: '700' }}>{sala.nombre}</h2>
                <button onClick={() => eliminarCola(sala.id, sala.nombre)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', padding: '5px 10px', borderRadius: '6px', transition: 'all 0.2s' }} onMouseOver={(e) => { e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.target.style.color = '#ef4444'; }} onMouseOut={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#64748b'; }}>
                  Eliminar
                </button>
              </div>

              {/* Indicador de Espera */}
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: enEspera > 0 ? 'rgba(56, 189, 248, 0.1)' : '#0f172a', color: enEspera > 0 ? '#7dd3fc' : '#64748b', padding: '8px 20px', borderRadius: '30px', fontSize: '0.95rem', fontWeight: '600', border: `1px solid ${enEspera > 0 ? 'rgba(56, 189, 248, 0.2)' : '#334155'}` }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: enEspera > 0 ? '#38bdf8' : '#475569', animation: enEspera > 0 ? 'pulse 2s infinite' : 'none' }}></span>
                  Pacientes en espera: {enEspera}
                </div>
              </div>

              {/* NUEVO: Botón Imprimir Ticket Manual */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => generarTurnoManual(sala.id, sala.nombre)}
                  disabled={estaCargando}
                  style={{ background: 'none', border: '1px dashed #475569', color: '#94a3b8', padding: '6px 15px', borderRadius: '8px', fontSize: '0.85rem', cursor: estaCargando ? 'wait' : 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={(e) => { !estaCargando && (e.target.style.backgroundColor = 'rgba(248, 250, 252, 0.05)', e.target.style.color = '#e2e8f0', e.target.style.border = '1px dashed #94a3b8') }}
                  onMouseOut={(e) => { !estaCargando && (e.target.style.backgroundColor = 'transparent', e.target.style.color = '#94a3b8', e.target.style.border = '1px dashed #475569') }}
                >
                  🖨️ Imprimir turno papel
                </button>
              </div>

              {/* Turno Actual */}
              <div style={{ textAlign: 'center', margin: '0 0 2rem 0', padding: '1.5rem', backgroundColor: '#0f172a', borderRadius: '16px', border: '1px dashed #334155' }}>
                <p style={{ margin: '0 0 10px 0', color: '#94a3b8', fontSize: '0.95rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' }}>En consulta ahora</p>
                <div style={{ fontSize: '4.5rem', fontWeight: '800', color: turno ? '#34d399' : '#475569', letterSpacing: '2px', lineHeight: '1', textShadow: turno ? '0 0 15px rgba(52, 211, 153, 0.2)' : 'none' }}>
                  {turno ? turno.numero : '-'}
                </div>
              </div>

              {/* Botones Secundarios */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', minHeight: '45px' }}>
                {turno && (
                  <>
                    <button 
                      onClick={() => reLlamar(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '10px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: '700', fontSize: '0.95rem', transition: 'background-color 0.2s' }}
                      onMouseOver={(e) => !estaCargando && (e.target.style.backgroundColor = 'rgba(2, 132, 199, 0.25)')} onMouseOut={(e) => !estaCargando && (e.target.style.backgroundColor = 'rgba(2, 132, 199, 0.15)')}
                    >
                      🔔 Re-llamar
                    </button>
                    <button 
                      onClick={() => descartarTurno(sala.id)} disabled={estaCargando}
                      style={{ flex: 1, padding: '12px', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#f87171', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '10px', cursor: estaCargando ? 'wait' : 'pointer', fontWeight: '700', fontSize: '0.95rem', transition: 'background-color 0.2s' }}
                      onMouseOver={(e) => !estaCargando && (e.target.style.backgroundColor = 'rgba(220, 38, 38, 0.2)')} onMouseOut={(e) => !estaCargando && (e.target.style.backgroundColor = 'rgba(220, 38, 38, 0.1)')}
                    >
                      ✕ Descartar
                    </button>
                  </>
                )}
              </div>

              {/* Botón Principal */}
              <button 
                onClick={() => llamarSiguiente(sala.id)}
                disabled={estaCargando || enEspera === 0}
                style={{ marginTop: 'auto', padding: '18px', width: '100%', cursor: (estaCargando || enEspera === 0) ? 'not-allowed' : 'pointer', background: (estaCargando || enEspera === 0) ? '#334155' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: (estaCargando || enEspera === 0) ? '#64748b' : 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', boxShadow: (estaCargando || enEspera === 0) ? 'none' : '0 10px 15px -3px rgba(16, 185, 129, 0.2)', transition: 'transform 0.1s, box-shadow 0.1s' }}
                onMouseDown={(e) => { if(!estaCargando && enEspera > 0) e.target.style.transform = 'scale(0.98)' }} 
                onMouseUp={(e) => { if(!estaCargando && enEspera > 0) e.target.style.transform = 'scale(1)' }}
              >
                {estaCargando ? 'Procesando...' : 'Llamar Siguiente'}
              </button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }`}</style>
    </div>
  )
}