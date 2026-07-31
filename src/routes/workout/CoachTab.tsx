import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Ban,
  AlertTriangle,
  Info,
  Loader2,
  Save,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Separator } from '@/components/ui/Separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useRoutines } from '@/features/workout/useRoutines'
import { useExercises } from '@/features/workout/useExercises'
import {
  useSaveGeneratedProgram,
  useTrainingCoach,
  type CoachFinding,
  type CoachResponse,
} from '@/features/workout/useTrainingCoach'
import { muscleLabel } from '@/features/workout/types'

type ActionKey = 'review' | 'analyze_routine' | 'progression' | 'generate_routine'

const ACTION_LABELS: Record<ActionKey, string> = {
  review: 'Fai il punto',
  analyze_routine: 'Analizza una scheda',
  progression: 'Prepara la prossima seduta',
  generate_routine: 'Genera un programma',
}

export function CoachTab() {
  const { data: routines = [], isError: routinesError } = useRoutines()
  const coach = useTrainingCoach()
  const saveProgram = useSaveGeneratedProgram()

  const [running, setRunning] = useState<ActionKey | null>(null)
  const [result, setResult] = useState<CoachResponse | null>(null)
  const [lastAction, setLastAction] = useState<ActionKey | null>(null)
  const [analyzeId, setAnalyzeId] = useState('')
  const [progressionId, setProgressionId] = useState('')
  const [brief, setBrief] = useState('')

  const busy = running !== null

  async function run(action: ActionKey, routineId?: string, text?: string) {
    setRunning(action)
    setResult(null)
    try {
      const res = await coach.mutateAsync({
        action,
        routineId,
        brief: text,
      })
      setResult(res)
      setLastAction(action)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Il coach non ha risposto',
      )
    } finally {
      setRunning(null)
    }
  }

  async function handleSaveProgram() {
    if (!result?.program) return
    try {
      await saveProgram.mutateAsync(result.program)
      toast.success('Programma salvato tra le schede')
      setResult(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Errore nel salvataggio',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          title="Fai il punto"
          description="Analisi delle ultime 6 settimane: frequenza, volume per gruppo muscolare e progressi sui fondamentali."
          busy={busy}
          running={running === 'review'}
          onRun={() => run('review')}
        />

        <ActionCard
          title="Analizza una scheda"
          description="Controlla equilibrio, selezione esercizi e volume di una scheda esistente."
          busy={busy}
          running={running === 'analyze_routine'}
          onRun={() => run('analyze_routine', analyzeId)}
          disabled={!analyzeId}
        >
          <RoutineSelect
            value={analyzeId}
            onChange={setAnalyzeId}
            routines={routines}
            hasError={routinesError}
          />
        </ActionCard>

        <ActionCard
          title="Prepara la prossima seduta"
          description="Propone carichi e ripetizioni per la prossima esecuzione, partendo dall'ultima volta."
          busy={busy}
          running={running === 'progression'}
          onRun={() => run('progression', progressionId)}
          disabled={!progressionId}
        >
          <RoutineSelect
            value={progressionId}
            onChange={setProgressionId}
            routines={routines}
            hasError={routinesError}
          />
        </ActionCard>

        <ActionCard
          title="Genera un programma"
          description="Crea un programma completo su misura: descrivi giorni, obiettivo e vincoli."
          busy={busy}
          running={running === 'generate_routine'}
          onRun={() => run('generate_routine', undefined, brief)}
          disabled={brief.trim().length < 10}
        >
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="es. 4 giorni a settimana, ipertrofia, ho 1 ora a seduta, poco tempo per le gambe il venerdì"
            className="min-h-[88px] text-sm"
          />
        </ActionCard>
      </div>

      {busy && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card/50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Sto analizzando… può richiedere fino a un minuto.
          </p>
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {lastAction ? ACTION_LABELS[lastAction] : 'Risposta del coach'}
            </CardTitle>
            {result.weekly_sets.length > 0 && (
              <CardDescription>
                Serie settimanali stimate per gruppo muscolare
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {result.weekly_sets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.weekly_sets.map((w) => (
                  <span
                    key={w.muscle}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {muscleLabel(w.muscle)}{' '}
                    <span className="font-mono tabular text-foreground">
                      {w.setsPerWeek}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {result.findings.length > 0 && (
              <ul className="space-y-2">
                {result.findings.map((f, i) => (
                  <FindingRow key={`${f.code}-${i}`} finding={f} />
                ))}
              </ul>
            )}

            {result.text && (
              <>
                {result.findings.length > 0 && <Separator />}
                <div className="prose-chat text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.text}
                  </ReactMarkdown>
                </div>
              </>
            )}

            {result.program && (
              <>
                <Separator />
                <ProgramPreview program={result.program} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveProgram}
                    disabled={saveProgram.isPending}
                  >
                    {saveProgram.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salva come schede
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResult(null)}
                    disabled={saveProgram.isPending}
                  >
                    <X className="h-4 w-4" />
                    Scarta
                  </Button>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span className="font-mono">{result.model}</span>
              <span className="font-mono tabular">
                {formatUsd(result.cost_cents)}
              </span>
              <span className="font-mono tabular">
                budget residuo {formatUsd(result.budget_remaining_cents)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// I costi arrivano in centesimi di dollaro: quattro decimali perché
// una singola call costa spesso meno di un centesimo.
function formatUsd(cents: number): string {
  return `$${(Number(cents) / 100).toFixed(4)}`
}

function ActionCard({
  title,
  description,
  onRun,
  running,
  busy,
  disabled,
  children,
}: {
  title: string
  description: string
  onRun: () => void
  running: boolean
  busy: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        {children}
        <Button
          type="button"
          onClick={onRun}
          disabled={busy || disabled}
          className="w-full"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sto analizzando…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Chiedi al coach
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function RoutineSelect({
  value,
  onChange,
  routines,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  routines: Array<{ id: string; name: string }>
  hasError: boolean
}) {
  if (hasError) {
    return (
      <p className="text-xs text-destructive">
        Non è stato possibile caricare le schede.
      </p>
    )
  }
  if (routines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nessuna scheda disponibile: creane una dalla tab Schede.
      </p>
    )
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Scegli una scheda" />
      </SelectTrigger>
      <SelectContent>
        {routines.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FindingRow({ finding }: { finding: CoachFinding }) {
  const Icon =
    finding.severity === 'block'
      ? Ban
      : finding.severity === 'warn'
        ? AlertTriangle
        : Info
  const style =
    finding.severity === 'block'
      ? 'border-destructive/40 bg-destructive/5 text-destructive'
      : finding.severity === 'warn'
        ? 'border-warning/40 bg-warning/5 text-warning'
        : 'border-border bg-card/50 text-muted-foreground'

  return (
    <li className={cn('flex gap-2 rounded-md border p-2.5', style)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="text-sm leading-relaxed">{finding.message}</span>
    </li>
  )
}

function ProgramPreview({
  program,
}: {
  program: NonNullable<CoachResponse['program']>
}) {
  const { data: exercises = [] } = useExercises()
  const names = useMemo(
    () => new Map(exercises.map((e) => [e.id, e.name])),
    [exercises],
  )

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-mono text-lg font-semibold">
          {program.program_name}
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[
            program.goal,
            program.days_per_week != null
              ? `${program.days_per_week} giorni a settimana`
              : null,
            program.weeks_planned != null
              ? `${program.weeks_planned} settimane`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {program.rationale && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {program.rationale}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {program.routines.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className="rounded-md border border-border bg-background/50 p-3"
          >
            <p className="text-sm font-medium">{r.name}</p>
            {r.notes && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {r.notes}
              </p>
            )}
            <ul className="mt-2 space-y-1">
              {r.exercises.map((e, j) => (
                <li
                  key={`${e.exercise_id}-${j}`}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    {names.get(e.exercise_id) ?? 'Esercizio sconosciuto'}
                  </span>
                  <span className="shrink-0 font-mono tabular text-muted-foreground">
                    {e.target_sets} ×{' '}
                    {e.rep_min != null && e.rep_max != null
                      ? `${e.rep_min}-${e.rep_max}`
                      : (e.rep_max ?? e.rep_min ?? '—')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
