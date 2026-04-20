import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { ArrowRight, TrendingDown, TrendingUp, Minus, Utensils } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import {
  sumMealTotals,
  useMealsForDate,
} from '@/features/meals/useMeals'
import { Button } from '@/components/ui/Button'
import { round0 } from '@/lib/macro'

export function Home() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: measurements } = useMeasurements()
  const { data: todayMeals = [] } = useMealsForDate(new Date())

  const totals = useMemo(() => sumMealTotals(todayMeals), [todayMeals])

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

  const currentWeight = latest?.weight_kg != null ? Number(latest.weight_kg) : null
  // Target proteine: 1.8 g/kg del peso target (fallback su peso attuale)
  const proteinRef = profile?.goal_weight_kg ?? currentWeight
  const proteinTarget = proteinRef ? round0(Number(proteinRef) * 1.8) : null

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
        <MetricCard
          label="Kcal oggi"
          value={todayMeals.length > 0 ? round0(totals.kcal).toString() : '—'}
          unit="kcal"
        />
        <MetricCard
          label="Proteine"
          value={todayMeals.length > 0 ? round0(totals.protein_g).toString() : '—'}
          unit="g"
          hint={proteinTarget ? `target ${proteinTarget}g` : undefined}
        />
        <WeightCard
          weight={latest?.weight_kg != null ? Number(latest.weight_kg) : null}
          delta={weightDelta}
          measuredAt={latest?.measured_at ?? null}
          goal={profile?.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null}
          toGoal={weightToGoal}
        />
      </div>

      {!profile?.height_cm || !profile?.sex ? (
        <OnboardCard
          title="Completa il tuo profilo"
          description="Inserisci sesso, altezza e obiettivo per abilitare i calcoli personalizzati."
          to="/settings"
          cta="Vai alle impostazioni"
        />
      ) : !latest ? (
        <OnboardCard
          title="Aggiungi la prima misura"
          description="Profilo ok. Inserisci peso (e opzionalmente body fat) per iniziare a tracciare."
          to="/settings"
          cta="Aggiungi misura"
        />
      ) : todayMeals.length === 0 ? (
        <OnboardCard
          title="Logga il primo pasto di oggi"
          description="Scansiona un barcode, cerca un alimento o inserisci manualmente."
          to="/meals"
          cta="Aggiungi pasto"
          icon={Utensils}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {todayMeals.length} {todayMeals.length === 1 ? 'pasto' : 'pasti'} oggi
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Mediamente {round0(totals.kcal / Math.max(1, todayMeals.length))} kcal
                per entry.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/meals">
                Vedi dettagli
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function OnboardCard({
  title,
  description,
  to,
  cta,
  icon: Icon = ArrowRight,
}: {
  title: string
  description: string
  to: string
  cta: string
  icon?: typeof ArrowRight
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-4" size="sm">
        <Link to={to}>
          <Icon className="h-4 w-4" />
          {cta}
        </Link>
      </Button>
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
        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {hint}
        </p>
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
          <span className="ml-1 text-sm font-normal text-muted-foreground">kg</span>
        </p>
        {delta != null && <DeltaBadge value={delta} />}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {measuredAt
          ? format(parseISO(measuredAt), 'd MMM yyyy', { locale: it })
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
