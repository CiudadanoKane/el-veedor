import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.jsx'
import { aplicarTema, seguirAlSistema } from './lib/tema.js'

// El tema ya lo fijó el script en línea de index.html; esto ajusta además el
// color de la barra del navegador y empieza a seguir los cambios del sistema.
aplicarTema()
seguirAlSistema()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
    {/* Vercel Web Analytics: cuenta visitas y páginas, sin cookies. */}
    <Analytics />
  </StrictMode>,
)
