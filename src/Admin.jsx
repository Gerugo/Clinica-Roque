import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'

export default function Admin() {
  const [colas, setColas] = useState([])
  const [colaSeleccionada, setColaSeleccionada] = useState('')
  // Inicializamos en un guion en lugar de 0
  const [turnoActual, setTurnoActual] = useState('-')
  const [cargando, setCargando] = useState(false)
  const [nuevaConsulta, setNuevaConsulta] = useState('')
  const [creandoCola, setCreandoCola] = useState(false)

  // Generador de códigos aleatorios (ej: "M4P")
  const generarCodigo = () => {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let codigo = ''
    for (let i = 0; i < 3; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    }
    return codigo
  }

  // 1. Cargar las consultas activas al iniciar el panel
  useEffect(() => {
    const obtenerColas = async () => {
      const { data, error } = await supabase
        .from('colas')
        .select('*')
        .eq('activa', true)
        .order('id', { ascending: true })
      
      if (!error && data) {
        setColas(data)
        if (data.length > 0 && !colaSeleccionada) {
          setColaSeleccionada(data[0].id)
        }
      }
    }
    obtenerColas()
  }, [colaSeleccionada])

  // 2. Buscar el último turno de la consulta seleccionada
  useEffect(() => {
    const obtenerUltimoTurno = async () => {
      if (!colaSeleccionada) return
      
      const { data, error } = await supabase
        .from('turnos')
        .select('numero') // Seguimos usando la columna 'numero', que ahora es texto
        .eq('cola_id', colaSeleccionada)
        .order('created_at', { ascending: false }) // Importante: ordenamos por fecha, no por alfabeto
        .limit(1)

      if (!error && data && data.length > 0) {
        setTurnoActual(data[0].numero)
      } else {
        setTurnoActual('-')
      }
    }
    obtenerUltimoTurno()
  }, [colaSeleccionada])

  // 3. Registrar el nuevo turno en Supabase
  const llamarSiguiente = async () => {
    if (!colaSeleccionada) {
      alert('Por favor, selecciona una consulta primero.')
      return
    }

    setCargando(true)
    const nuevoCodigo = generarCodigo()
    
    const { error } = await supabase
      .from('turnos')
      .insert([
        { 
          cola_id: colaSeleccionada,
          numero: nuevoCodigo, // Enviamos el texto aleatorio (ej. "T8K")
          estado: 'llamado' 
        }
      ])

    if (error) {
      console.error('Error al guardar el turno:', error)
      alert('Error de conexión al guardar el turno. ¿Cambiaste el tipo a text en Supabase?')
    } else {
      setTurnoActual(nuevoCodigo)
    }
    
    setCargando(false)
  }

  // 4. Crear una nueva consulta directamente desde el panel
  const crearNuevaConsulta = async () => {
    if (!nuevaConsulta.trim()) return

    setCreandoCola(true)
    
    const { data, error } = await supabase
      .from('colas')
      .insert([
        { 
          nombre: nuevaConsulta.trim(), 
          activa: true 
        }
      ])
      .select()

    if (error) {
      console.error('Error al crear consulta:', error)
      alert('Hubo un error al crear la sala.')
    } else if (data && data.length > 0) {
      setColas([...colas, data[0]])
      setColaSeleccionada(data[0].id)
      setNuevaConsulta('')
    }
    
    setCreandoCola(false)
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ color: '#2c3e50', fontSize: '2rem', marginBottom: '2rem' }}>Panel Médico</h2>
      
      {/* Sección de Selección y Creación de Consultas */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: '15px', 
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        maxWidth: '500px',
        margin: '0 auto 2rem auto'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <label style={{ fontWeight: 'bold', color: '#34495e', whiteSpace: 'nowrap' }}>Sala:</label>
          <select 
            value={colaSeleccionada} 
            onChange={(e) => setColaSeleccionada(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            {colas.map(cola => (
              <option key={cola.id} value={cola.id}>{cola.nombre}</option>
            ))}
          </select>
        </div>

        <hr style={{ width: '100%', border: '0.5px solid #dee2e6' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <input 
            type="text" 
            placeholder="Ej: Enfermería, Dr. López..." 
            value={nuevaConsulta}
            onChange={(e) => setNuevaConsulta(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <button 
            onClick={crearNuevaConsulta}
            disabled={creandoCola || !nuevaConsulta.trim()}
            style={{
              padding: '10px 15px',
              backgroundColor: (creandoCola || !nuevaConsulta.trim()) ? '#bdc3c7' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: (creandoCola || !nuevaConsulta.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {creandoCola ? 'Creando...' : 'Añadir Sala'}
          </button>
        </div>
      </div>

      {/* Pantalla del turno actual */}
      <div style={{ margin: '0 auto 2rem auto', padding: '2rem', maxWidth: '400px', backgroundColor: '#fff', borderRadius: '15px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <p style={{ fontSize: '1.2rem', color: '#7f8c8d', margin: '0' }}>Último turno de esta sala:</p>
        <p style={{ fontSize: '5rem', fontWeight: 'bold', color: '#2980b9', margin: '10px 0', letterSpacing: '2px' }}>
          {turnoActual}
        </p>
      </div>
      
      {/* Botón de llamada */}
      <button 
        onClick={llamarSiguiente} 
        disabled={cargando || !colaSeleccionada}
        style={{ 
          padding: '15px 40px', 
          cursor: (cargando || !colaSeleccionada) ? 'not-allowed' : 'pointer',
          backgroundColor: (cargando || !colaSeleccionada) ? '#95a5a6' : '#27ae60',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1.3rem',
          fontWeight: 'bold',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 6px rgba(39, 174, 96, 0.2)'
        }}
      >
        {cargando ? 'Registrando...' : 'Llamar Siguiente Paciente'}
      </button>
    </div>
  )
}