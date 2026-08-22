import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
      <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', fontWeight: '800' }}>404</h1>
      <h2 style={{ fontSize: '1.4rem', color: '#94a3b8', margin: '0 0 20px 0', fontWeight: '500' }}>
        Página no encontrada
      </h2>
      <p style={{ color: '#64748b', maxWidth: '400px', marginBottom: '2rem' }}>
        La ruta a la que intentas acceder no existe en el sistema de Clínica Roque.
      </p>
      <div style={{ display: 'flex', gap: '15px' }}>
        <Link
          to="/recepcion"
          style={{
            padding: '12px 24px',
            backgroundColor: '#0284c7',
            color: 'white',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          📱 Vista Paciente
        </Link>
        <Link
          to="/"
          style={{
            padding: '12px 24px',
            backgroundColor: '#334155',
            color: 'white',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          📺 Pantalla TV
        </Link>
      </div>
    </div>
  )
}
