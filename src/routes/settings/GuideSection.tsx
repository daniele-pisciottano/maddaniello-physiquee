import { BookOpen, Check, Circle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  openTutorial,
  useSetupChecklist,
} from '@/features/tutorial/useTutorial'

export function GuideSection() {
  const { steps, isLoading, doneCount, total } = useSetupChecklist()
  const incomplete = steps.filter((s) => !s.done)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guida all'uso</CardTitle>
        <CardDescription>
          Il tour delle sezioni e i passaggi di configurazione.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isLoading && (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm">
              Configurazione:{' '}
              <span
                className={cn(
                  'font-mono tabular font-semibold',
                  doneCount === total ? 'text-primary' : 'text-warning',
                )}
              >
                {doneCount}/{total}
              </span>
            </p>
            {incomplete.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {incomplete.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs">
                    <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {s.label} — {s.hint}
                    </span>
                    <Link
                      to={s.path}
                      className="shrink-0 text-primary hover:underline"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" />
                Tutto configurato.
              </p>
            )}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={openTutorial}
        >
          <BookOpen className="h-4 w-4" />
          Rivedi la guida
        </Button>
        <p className="text-xs text-muted-foreground">
          Puoi rilanciarla quante volte vuoi. Il pulsante <strong>?</strong>{' '}
          accanto al titolo di ogni pagina spiega invece quella singola sezione.
        </p>
      </CardContent>
    </Card>
  )
}
