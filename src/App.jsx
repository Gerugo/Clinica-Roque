import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Pantalla from './Pantalla'
import Admin from './Admin'
import Recepcion from './Recepcion'

function App() {
  const [modoKiosco, setModoKiosco] = useState(false)

  useEffect(() => {
    // Detecta si la web se está ejecutando como app instalada en el móvil/PC (PWA)
    const esPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setModoKiosco(esPWA);
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Si detecta que es la PWA instalada, te expulsa automáticamente a recepción. 
            Si entras desde el navegador web normal, te muestra la pantalla de la TV. */}
        <Route 
          path="/" 
          element={modoKiosco ? <Navigate to="/recepcion" replace /> : <Pantalla />} 
        />
        
        {/* BLINDAJE AÑADIDO: Si estás en la PWA y tratas de ir a /admin, te devuelve a recepción */}
        <Route 
          path="/admin" 
          element={modoKiosco ? <Navigate to="/recepcion" replace /> : <Admin />} 
        />
        
        <Route path="/recepcion" element={<Recepcion />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
