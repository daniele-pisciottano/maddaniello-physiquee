import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Utensils,
  Target,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import {
  sumMealTotals,
  useMealsForDate,
} from '@/features/meals/useMeals'
import { useReviewStatus } from '@/features/reviews/useReviews'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { round0 } from '@/lib/macro'
import { BarChart3 } from 'lucide-react'

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

  const hasTargets =
    profile?.target_kcal != null ||
    profile?.target_protein_g != null ||
    profile?.target_carb_g != null ||
    profile?.target_fat_g != null

  const reviewStatus = useReviewStatus()

  const targets = {
    kcal: profile?.target_kcal ?? null,
    protein: profile?.target_protein_g ?? null,
    carb: profile?.target_carb_g ?? null,
    fat: profile?.target_fat_g ?? null,
  }

  const actuals = {
    kcal: totals.kcal,
    protein: totals.protein_g,
    carb: totals.carb_g,
    fat: totals.fat_g,
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Oggi · {format(new Date(), 'EEEE d MMMM', { locale: it })}
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Ciao.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Review banner — priorità massima se presente */}
      {reviewStatus.hasPendingAction && reviewStatus.latest && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20">
              <BarChart3 className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-warning">
                Review: l'AI suggerisce un aggiustamento
              </h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {reviewStatus.latest.ai_suggestion?.summary}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/reviews">Vedi</Link>
            </Button>
          </div>
        </div>
      )}

      {!reviewStatus.hasPendingAction &&
        reviewStatus.dueForNewReview &&
        hasGoal &&
        hasTargets && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Review bisettimanale</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviewStatus.latest
                    ? `Ultima review ${reviewStatus.daysSinceLatest} giorni fa. Genera la prossima.`
                    : 'Non hai mai generato una review. Dopo 14 giorni di tracking è il momento giusto.'}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to="/reviews">Apri</Link>
              </Button>
            </div>
          </div>
        )}

      {/* 4 macro cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MacroCard
          label="Kcal"
          unit=""
          actual={actuals.kcal}
          target={targets.kcal}
          accent
        />
        <MacroCard
          label="Proteine"
          unit="g"
          actual={actuals.protein}
          target={targets.protein}
        />
        <MacroCard
          label="Carboidrati"
          unit="g"
          actual={actuals.carb}
          target={targets.carb}
        />
        <MacroCard
          label="Grassi"
          unit="g"
          actual={actuals.fat}
          target={targets.fat}
        />
      </div>

      {/* Peso */}
      <WeightRow
        weight={latest?.weight_kg != null ? Number(latest.weight_kg) : null}
        delta={weightDelta}
        measuredAt={latest?.measured_at ?? null}
        goal={
          profile?.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null
        }
        toGoal={weightToGoal}
      />

      {/* Next action / onboarding */}
      {!hasTargets ? (
        <OnboardCard
          title="Imposta i tuoi target giornalieri"
          description="Definisci kcal e macro (manuali o calcolati in un click dal profilo) per vedere quanto ti manca ogni giorno."
          to="/settings"
          cta="Vai ai target"
          icon={Target}
        />
      ) : !profile?.height_cm || !profile?.sex ? (
        <OnboardCard
          title="Completa il tuo profilo"
          description="Inserisci sesso, altezza e obiettivo per abilitare calcoli e suggerimenti più precisi."
          to="/settings"
          cta="Impostazioni"
        />
      ) : !latest ? (
        <OnboardCard
          title="Aggiungi la prima misura"
          description="Profilo ok. Inserisci peso (e body fat) per iniziare a tracciare l'andamento."
          to="/settings"
          cta="Aggiungi misura"
        />
      ) : todayMeals.length === 0 ? (
        <OnboardCard
          title="Logga il primo pasto di oggi"
          description="Scansiona un barcode, cerca un alimento o inserisci manualmente."
          to="/meals"
          cta="Vai ai pasti"
          icon={Utensils}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                {todayMeals.length} {todayMeals.length === 1 ? 'pasto' : 'pasti'} oggi
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ultimo:{' '}
                {format(parseISO(todayMeals[todayMeals.length - 1].eaten_at), 'HH:mm')}
                {' · '}
                {todayMeals[todayMeals.length - 1].food_name}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/meals">
                Dettagli
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MACRO CARD
// ============================================================
function MacroCard({
  label,
  unit,
  actual,
  target,
  accent,
}: {
  label: string
  unit: string
  actual: number
  target: number | null
  accent?: boolean
}) {
  const hasTarget = target != null && target > 0
  const remaining = hasTarget ? target - actual : null
  const pct = hasTarget ? Math.min(100, Math.max(0, (actual / target!) * 100)) : 0
  const over = hasTarget && actual > target!
  const overAmount = over ? actual - target! : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-2">
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'font-mono text-2xl font-semibold tabular',
              accent && 'text-primary',
            )}
          >
            {round0(actual)}
          </span>
          {hasTarget && (
            <span className="font-mono text-sm text-muted-foreground tabular">
              / {target}
              {unit && ` ${unit}`}
            </span>
          )}
          {!hasTarget && unit && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
        </div>
      </div>

      {hasTarget && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full transition-all',
                over ? 'bg-warning' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className={cn(
              'mt-1.5 font-mono text-[11px] tabular',
              over ? 'text-warning' : 'text-muted-foreground',
            )}
          >
            {over ? (
              <>
                +{round0(overAmount)}
                {unit} oltre target
              </>
            ) : (
              <>
                mancano {round0(remaining!)}
                {unit}
              </>
            )}
          </p>
        </>
      )}

      {!hasTarget && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nessun target impostato
        </p>
      )}
    </div>
  )
}

// ============================================================
// WEIGHT ROW
// ============================================================
function WeightRow({
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Peso attuale
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="font-mono text-2xl font-semibold tabular">
              {weight != null ? weight : '—'}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kg
              </span>
            </p>
            {delta != null && <DeltaBadge value={delta} />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {measuredAt
              ? format(parseISO(measuredAt), 'd MMM yyyy', { locale: it })
              : 'Nessuna misura'}
          </p>
        </div>
        {goal != null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Target
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular">
              {goal}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kg
              </span>
            </p>
            {toGoal != null && (
              <p className="mt-1 font-mono text-xs tabular text-muted-foreground">
                {toGoal > 0 ? '+' : ''}
                {toGoal.toFixed(1)} kg da fare
              </p>
            )}
          </div>
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
    <div className="rounded-lg border border-border bg-card p-5">
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
