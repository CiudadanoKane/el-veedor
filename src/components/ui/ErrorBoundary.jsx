import { Component } from 'react'

// Evita que un fallo en un módulo deje toda la página en blanco.
// Se coloca alrededor del contenido de ruta, para que la navegación siga viva.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // En desarrollo deja rastro en consola; en producción no rompe la vista.
    console.error('Fallo en un módulo de El Veedor:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-6">
        <h2 className="font-display font-semibold text-lg text-danger mb-2">
          Algo falló en esta sección
        </h2>
        <p className="text-textSecondary text-sm leading-relaxed mb-4">
          No pudimos mostrar esta vista. El resto de la plataforma sigue funcionando:
          puedes usar el menú para ir a otra sección. Si el problema persiste, es
          probable que la fuente de datos (SECOP II) esté respondiendo con lentitud o
          intermitencia.
        </p>
        <details className="mb-4">
          <summary className="text-xs text-textSecondary cursor-pointer hover:text-textPrimary">
            Detalle técnico
          </summary>
          <pre className="mt-2 text-xs text-textSecondary whitespace-pre-wrap break-words">
            {String(error?.message || error)}
          </pre>
        </details>
        <button
          onClick={this.reset}
          className="rounded-lg bg-primary/20 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/30 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }
}
