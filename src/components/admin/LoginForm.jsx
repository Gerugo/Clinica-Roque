import { useState } from 'react'

export function LoginForm({ onLogin, cargando, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email || !password || cargando) return
    onLogin(email, password)
  }

  return (
    <div className="admin-login-wrapper">
      <form onSubmit={handleSubmit} className="admin-login-card animate-fade-in">
        <div className="admin-login-icon" role="img" aria-label="Icono médico">
          🩺
        </div>
        <h2 className="admin-login-title">Acceso Médico</h2>

        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <label
            htmlFor="admin-email-input"
            style={{
              display: 'block',
              fontSize: '0.85rem',
              color: '#94a3b8',
              marginBottom: '6px',
              fontWeight: '500',
            }}
          >
            Correo Electrónico
          </label>
          <input
            id="admin-email-input"
            type="email"
            placeholder="doctor@clinica-roque.es"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            autoFocus
            className="admin-login-input"
          />
        </div>

        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <label
            htmlFor="admin-password-input"
            style={{
              display: 'block',
              fontSize: '0.85rem',
              color: '#94a3b8',
              marginBottom: '6px',
              fontWeight: '500',
            }}
          >
            Contraseña
          </label>
          <input
            id="admin-password-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="admin-login-input"
          />
        </div>

        {error && (
          <p className="admin-login-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="admin-login-submit-btn"
          style={{ opacity: cargando ? 0.7 : 1 }}
        >
          {cargando ? 'Verificando...' : 'Entrar al Panel'}
        </button>
      </form>
    </div>
  )
}
