import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import Admin from './Admin'
import Pantalla from './Pantalla'

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="header">
          <h1>Clínica Roque</h1>
          <h2>Médico de familia</h2>
          
          {/* Navegación temporal para desarrollo */}
          <nav style={{ marginTop: '1.5rem', marginBottom: '2rem', gap: '15px', display: 'flex', justifyContent: 'center' }}>
            <Link to="/" style={{ textDecoration: 'none', color: '#3498db', fontWeight: 'bold' }}>Ver Sala de Espera</Link>
            <span style={{ color: '#ccc' }}>|</span>
            <Link to="/admin" style={{ textDecoration: 'none', color: '#e74c3c', fontWeight: 'bold' }}>Ver Panel Médico</Link>
          </nav>
        </header>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Pantalla />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App