import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Pantalla from './Pantalla'
import Admin from './Admin'
import Recepcion from './Recepcion'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Pantalla />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/recepcion" element={<Recepcion />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App