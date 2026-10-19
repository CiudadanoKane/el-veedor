import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { FiltersProvider } from './context/FiltersContext'
import { TourProvider } from './components/ui/Tour'
import { Layout } from './components/layout/Layout'
import { lazy } from 'react'

// Cada página es su propio archivo de código, que se baja al entrar a ella.
// Antes iba todo en uno: 342 KB comprimidos de JS de entrada, gráficos
// incluidos, aunque solo se abriera Noticias. Quien llega por un enlace
// compartido en un chat —con datos móviles— es justo quien más lo pagaba.
const pagina = (cargar, nombre) => lazy(() => cargar().then((m) => ({ default: m[nombre] })))
const Dashboard = pagina(() => import('./pages/Dashboard'), 'Dashboard')
const Noticias = pagina(() => import('./pages/Noticias'), 'Noticias')
const Buscar = pagina(() => import('./pages/Buscar'), 'Buscar')
const Alertas = pagina(() => import('./pages/Alertas'), 'Alertas')
const Errores = pagina(() => import('./pages/Errores'), 'Errores')
const Rankings = pagina(() => import('./pages/Rankings'), 'Rankings')
const ConstructorGraficos = pagina(() => import('./pages/ConstructorGraficos'), 'ConstructorGraficos')
const Contratista = pagina(() => import('./pages/Contratista'), 'Contratista')
const Entidad = pagina(() => import('./pages/Entidad'), 'Entidad')
const Aprender = pagina(() => import('./pages/Aprender'), 'Aprender')
const Transparencia = pagina(() => import('./pages/Transparencia'), 'Transparencia')
const Reportar = pagina(() => import('./pages/Reportar'), 'Reportar')
import { PESTANAS_ALERTAS, PESTANAS_RANKINGS } from './lib/pestanas'

// Redirección que CONSERVA la query. `<Navigate to="/alertas">` la descarta, y
// en estas rutas el ámbito viaja ahí: un enlace compartido a
// /mi-municipio?ciudad=Barranquilla tiene que llegar al retrato de Barranquilla
// y no al panorama nacional, igual que /mora?departamento=Meta debe seguir
// filtrando por Meta al aterrizar en Alertas.
// `t` lleva además a la PESTAÑA que era esa ruta. Sin él la redirección
// cumplía a medias: /adiciones aterrizaba en "Contratos vencidos" y
// /categorias en "Quién recibe más", que no es lo que el enlace prometía.
// Conservar la ruta viva pero mandarla al sitio equivocado engaña más que un
// 404 —quien la comparte cree que sigue funcionando—.
function Redirigir({ a, t }) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  if (t) params.set('t', t)
  const qs = params.toString()
  return <Navigate to={{ pathname: a, search: qs ? `?${qs}` : '' }} replace />
}

function App() {
  return (
    <BrowserRouter>
      <FiltersProvider>
        <TourProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="noticias" element={<Noticias />} />
            <Route path="buscar" element={<Buscar />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="errores" element={<Errores />} />
            <Route path="rankings" element={<Rankings />} />
            <Route path="constructor" element={<ConstructorGraficos />} />
            <Route path="contratista/:documento" element={<Contratista />} />
            <Route path="entidad/:nombre" element={<Entidad />} />
            <Route path="aprender" element={<Aprender />} />
            <Route path="transparencia" element={<Transparencia />} />
            <Route path="reportar" element={<Reportar />} />

            {/* Secciones que dejaron de ser propias y pasaron a ser pestañas de
                otra página. Las rutas viejas siguen vivas: pueden estar
                compartidas por ahí, y un enlace roto en una plataforma de
                veeduría es justo lo que no queremos. */}
            <Route path="mora" element={<Redirigir a="/alertas" t={PESTANAS_ALERTAS.vencidos} />} />
            <Route path="adiciones" element={<Redirigir a="/alertas" t={PESTANAS_ALERTAS.adiciones} />} />
            <Route path="categorias" element={<Redirigir a="/rankings" t={PESTANAS_RANKINGS.categorias} />} />
            {/* "Mi municipio" dejó de ser una página aparte: el Panorama toma
                su forma cuando hay un departamento o municipio activo. */}
            <Route path="mi-municipio" element={<Redirigir a="/" />} />
          </Route>
        </Routes>
        </TourProvider>
      </FiltersProvider>
    </BrowserRouter>
  )
}

export default App
