import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FiltersProvider } from './context/FiltersContext'
import { TourProvider } from './components/ui/Tour'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { MiMunicipio } from './pages/MiMunicipio'
import { Noticias } from './pages/Noticias'
import { Buscar } from './pages/Buscar'
import { Alertas } from './pages/Alertas'
import { Errores } from './pages/Errores'
import { Rankings } from './pages/Rankings'
import { Contratista } from './pages/Contratista'
import { Entidad } from './pages/Entidad'
import { Aprender } from './pages/Aprender'
import { Transparencia } from './pages/Transparencia'
import { Reportar } from './pages/Reportar'

function App() {
  return (
    <BrowserRouter>
      <FiltersProvider>
        <TourProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="mi-municipio" element={<MiMunicipio />} />
            <Route path="noticias" element={<Noticias />} />
            <Route path="buscar" element={<Buscar />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="errores" element={<Errores />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="contratista/:documento" element={<Contratista />} />
            <Route path="entidad/:nombre" element={<Entidad />} />
            <Route path="aprender" element={<Aprender />} />
            <Route path="transparencia" element={<Transparencia />} />
            <Route path="reportar" element={<Reportar />} />

            {/* Secciones que dejaron de ser propias y pasaron a ser pestañas de
                otra página. Las rutas viejas siguen vivas: pueden estar
                compartidas por ahí, y un enlace roto en una plataforma de
                veeduría es justo lo que no queremos. */}
            <Route path="mora" element={<Navigate to="/alertas" replace />} />
            <Route path="adiciones" element={<Navigate to="/alertas" replace />} />
            <Route path="categorias" element={<Navigate to="/rankings" replace />} />
          </Route>
        </Routes>
        </TourProvider>
      </FiltersProvider>
    </BrowserRouter>
  )
}

export default App
