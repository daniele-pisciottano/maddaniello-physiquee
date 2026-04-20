import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import { Button } from '@/components/ui/Button'

export function Home() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: measurements } = useMeasurements()

  const latest = measurements?.[0]
  const previous = measurements?.[1]
  const weightDelta =
    latest?.weight_kg != null && previous?.weight_kg != null
      ? Number(latest.weight_kg) - Number(previous.weight_kg)
      : null

  const hasGoal = profile?.goal_weight_kg != null
  const weightToGoal =
    hasGoal && latest?.weight_kg != null
      ? Number(profile.goal_weight_kg) - Number(latest.weight_kg)
      : null

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Benvenuto
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Ciao.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Kcal oggi" value="—" unit="kcal" hint="Fase 2" />
        <MetricCard label="Proteine" value="—" unit="g" hint="Fase 2" />
        <WeightCard
          weight={latest?.weight_kg ?? null}
          delta={weightDelta}
          measuredAt={latest?.measured_at ?? null}
          goal={profile?.goal_weight_kg ?? null}
          toGoal={weightToGoal}
        />
      </div>

      {!profile?.height_cm || !profile?.sex ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Completa il tuo profilo</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Inserisci sesso, altezza e obiettivo per abilitare i calcoli
            personalizzati.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/settings">
              Vai alle impostazioni
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : !latest ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Aggiungi la prima misura</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Profilo ok. Inserisci peso e (opzionale) body fat per iniziare a
            tracciare.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/settings">
              Aggiungi misura
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-semibold">Fase 1 attiva ✓</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Profilo completato e misure tracciate. I pasti e la chat AI
            arriveranno nelle Fasi 2 e 4+.
          </p>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string
  value: string
  unit: string
  hint?: string
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
      {hint && (
        <span className="absolute right-3 top-3 rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

function WeightCard({
  weight,
  delta,
  measuredAt,
  goal,
  toGoal,
}: {
  weight: number | null
  delta: number | null
  measuredAt: string | null
  goal: number | null
  toGoal: number | null
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Peso
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-mono text-3xl font-semibold tabular">
          {weight != null ? weight : '—'}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            kg
          </span>
        </p>
        {delta != null && <DeltaBadge value={delta} />}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {measuredAt
          ? format(parseISO(measuredAt), "d MMM yyyy", { locale: it })
          : 'Nessuna misura'}
        {toGoal != null && goal != null && (
          <>
            {' · '}
            {Math.abs(toGoal).toFixed(1)} kg {toGoal > 0 ? 'da guadagnare' : 'da perdere'}
          </>
        )}
      </div>
    </div>
  )
}

function DeltaBadge({ value }: { value: number }) {
  const isZero = Math.abs(value) < 0.05
  const Icon = isZero ? Minus : value > 0 ? TrendingUp : TrendingDown
  const color = isZero
    ? 'text-muted-foreground'
    : value > 0
      ? 'text-warning'
      : 'text-primary'
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs tabular ${color}`}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}
    </span>
  )
}
