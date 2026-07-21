import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FiltersProvider } from './context/FiltersContext'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Buscar } from './pages/Buscar'
import { Alertas } from './pages/Alertas'
import { Mora } from './pages/Mora'
import { Adiciones } from './pages/Adiciones'
import { Categorias } from './pages/Categorias'
import { Rankings } from './pages/Rankings'
import { Contratista } from './pages/Contratista'
import { Transparencia } from './pages/Transparencia'
import { Reportar } from './pages/Reportar'

function App() {
  return (
    <BrowserRouter>
      <FiltersProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="buscar" element={<Buscar />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="mora" element={<Mora />} />
            <Route path="adiciones" element={<Adiciones />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="contratista/:documento" element={<Contratista />} />
            <Route path="transparencia" element={<Transparencia />} />
            <Route path="reportar" element={<Reportar />} />
          </Route>
        </Routes>
      </FiltersProvider>
    </BrowserRouter>
  )
}

export default App
