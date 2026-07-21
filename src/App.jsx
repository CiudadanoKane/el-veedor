import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FiltersProvider } from './context/FiltersContext'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { Buscar } from './pages/Buscar'
import { Alertas } from './pages/Alertas'
import { Errores } from './pages/Errores'
import { Categorias } from './pages/Categorias'
import { Rankings } from './pages/Rankings'
import { Contratista } from './pages/Contratista'
import { Entidad } from './pages/Entidad'
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
            <Route path="errores" element={<Errores />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="contratista/:documento" element={<Contratista />} />
            <Route path="entidad/:nombre" element={<Entidad />} />
            <Route path="transparencia" element={<Transparencia />} />
            <Route path="reportar" element={<Reportar />} />

            {/* Contratos vencidos y Adiciones dejaron de ser secciones propias
                y pasaron a ser pestañas de Alertas. Las rutas viejas siguen
                vivas: pueden estar compartidas por ahí, y un enlace roto en una
                plataforma de veeduría es justo lo que no queremos. */}
            <Route path="mora" element={<Navigate to="/alertas" replace />} />
            <Route path="adiciones" element={<Navigate to="/alertas" replace />} />
          </Route>
        </Routes>
      </FiltersProvider>
    </BrowserRouter>
  )
}

export default App
