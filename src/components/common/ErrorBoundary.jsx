import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Capturado error no manejado:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
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
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🏥</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontWeight: '700' }}>
            Algo no ha ido como se esperaba
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '480px', marginBottom: '1.5rem' }}>
            La aplicación de Clínica Roque encontró un problema temporal. Por favor, pulsa el botón
            inferior para recargar la pantalla.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 28px',
              backgroundColor: '#38bdf8',
              color: '#0f172a',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            🔄 Recargar Aplicación
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
