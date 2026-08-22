import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { esModoStandalone } from './utils/deviceDetection.js'
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx'
import { NotFound } from './components/common/NotFound.jsx'
import { WaitingScreen } from './components/pantalla/WaitingScreen.jsx'
import { AdminDashboard } from './components/admin/AdminDashboard.jsx'
import { PatientView } from './components/recepcion/PatientView.jsx'

export default function App() {
  // Inicialización lazy para evitar parpadeo inicial en PWA instalada
  const [modoKiosco, setModoKiosco] = useState(() => esModoStandalone())

  useEffect(() => {
    // Escuchar cambios dinámicos del modo de visualización
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleChange = (e) => {
      setModoKiosco(e.matches || esModoStandalone())
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Ruta Raíz: Si está en PWA/móvil va a recepción, si no a la pantalla TV de sala de espera */}
          <Route
            path="/"
            element={
              modoKiosco ? (
                <Navigate to="/recepcion" replace />
              ) : (
                <WaitingScreen />
              )
            }
          />

          {/* Ruta Recepción: Vista del Paciente Móvil / Web */}
          <Route path="/recepcion" element={<PatientView />} />

          {/* Ruta Administración: Panel de Médicos y Personal */}
          <Route
            path="/admin"
            element={
              modoKiosco ? (
                <Navigate to="/recepcion" replace />
              ) : (
                <AdminDashboard />
              )
            }
          />

          {/* Ruta 404: Captura cualquier ruta inexistente */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
