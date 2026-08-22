import { useState } from 'react'

export function TicketRecoveryModal({ salas, buscando, error, onRecuperar, onCerrar }) {
  const [salaId, setSalaId] = useState('')
  const [codigo, setCodigo] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!salaId || !codigo.trim() || buscando) return
    onRecuperar(salaId, codigo)
  }

  return (
    <form onSubmit={handleSubmit} className="recepcion-recovery-box animate-fade-in">
      <p className="recepcion-recovery-title">Recuperar turno por código</p>

      <select
        value={salaId}
        onChange={(e) => setSalaId(e.target.value)}
        required
        className="recepcion-recovery-select"
      >
        <option value="">Selecciona la consulta médica...</option>
        {salas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        placeholder="Código de 3 letras (Ej: A4B)"
        maxLength={4}
        required
        className="recepcion-recovery-input"
      />

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 10px 0' }} role="alert">
          {error}
        </p>
      )}

      <div className="recepcion-recovery-actions">
        <button
          type="submit"
          disabled={buscando || !salaId || !codigo.trim()}
          className="recepcion-recovery-submit-btn"
        >
          {buscando ? 'Buscando...' : 'Recuperar'}
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="recepcion-recovery-cancel-btn"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
