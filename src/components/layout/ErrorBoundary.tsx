import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Rete di sicurezza per gli errori di render. Senza, un singolo errore in
 * un componente lascia la pagina completamente bianca e l'utente non ha
 * modo di capire cosa fare.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Errore di render:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="max-w-sm space-y-2">
          <h2 className="text-base font-semibold">Qualcosa è andato storto</h2>
          <p className="text-sm text-muted-foreground">
            Questa schermata non è riuscita a caricarsi. I tuoi dati non sono
            stati toccati.
          </p>
          <p className="break-words font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => this.setState({ error: null })}
          >
            Riprova
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={() => window.location.reload()}
          >
            <RotateCw className="h-4 w-4" />
            Ricarica l'app
          </Button>
        </div>
      </div>
    )
  }
}
