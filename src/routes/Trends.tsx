import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { format, parseISO, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import { useProfile } from '@/features/profile/useProfile'
import { QuickWeighDialog } from '@/components/QuickWeighDialog'

type Period = '7' | '30' | '90' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  '7': 'Ultimi 7 giorni',
  '30': 'Ultimi 30 giorni',
  '90': 'Ultimi 90 giorni',
  all: 'Tutto lo storico',
}

export function Trends() {
  const { data: measurements = [], isLoading } = useMeasurements()
  const { data: profile } = useProfile()
  const [period, setPeriod] = useState<Period>('30')
  const [quickOpen, setQuickOpen] = useState(false)

  const sortedAsc = useMemo(
    () =>
      measurements
        .slice()
        .sort((a, b) => a.measured_at.localeCompare(b.measured_at)),
    [measurements],
  )

  const periodData = useMemo(() => {
    if (period === 'all') return sortedAsc
    const days = Number(period)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return sortedAsc.filter((m) => m.measured_at >= cutoffStr)
  }, [sortedAsc, period])

  // Chart data con moving average del peso (finestra 7 punti)
  const chartData = useMemo(() => {
    const withWeight = periodData.filter((m) => m.weight_kg != null)
    return withWeight.map((m, i) => {
      const start = Math.max(0, i - 6)
      const slice = withWeight.slice(start, i + 1)
      const avg =
        slice.reduce((s, x) => s + Number(x.weight_kg), 0) / slice.length
      return {
        date: m.measured_at,
        label: format(parseISO(m.measured_at), 'd MMM', { locale: it }),
        weight: Number(m.weight_kg),
        ma7: Math.round(avg * 10) / 10,
        bf_scale:
          m.body_fat_scale_pct != null ? Number(m.body_fat_scale_pct) : null,
        bf_visual:
          m.body_fat_visual_pct != null ? Number(m.body_fat_visual_pct) : null,
        // fallback sul valore canonico se nessuno dei due è presente
        bf_legacy:
          m.body_fat_scale_pct == null &&
          m.body_fat_visual_pct == null &&
          m.body_fat_pct != null
            ? Number(m.body_fat_pct)
            : null,
      }
    })
  }, [periodData])

  // Stats: delta peso vs X giorni fa
  const stats = useMemo(() => {
    const withWeight = sortedAsc.filter((m) => m.weight_kg != null)
    if (withWeight.length === 0) return null
    const latest = withWeight[withWeight.length - 1]
    const now = Number(latest.weight_kg)

    function deltaOver(days: number) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      const earlier = withWeight.find((m) => m.measured_at >= cutoffStr)
      if (!earlier || earlier.measured_at === latest.measured_at) return null
      const diff = now - Number(earlier.weight_kg)
      return Math.round(diff * 10) / 10
    }

    return {
      latest: now,
      latestDate: latest.measured_at,
      delta7: deltaOver(7),
      delta30: deltaOver(30),
      delta90: deltaOver(90),
      bfLatest:
        latest.body_fat_visual_pct != null
          ? Number(latest.body_fat_visual_pct)
          : latest.body_fat_scale_pct != null
            ? Number(latest.body_fat_scale_pct)
            : latest.body_fat_pct != null
              ? Number(latest.body_fat_pct)
              : null,
    }
  }, [sortedAsc])

  const goalWeight = profile?.goal_weight_kg
    ? Number(profile.goal_weight_kg)
    : null
  const toGoal =
    goalWeight != null && stats?.latest != null
      ? Math.round((goalWeight - stats.latest) * 10) / 10
      : null

  const daysSinceLatest = stats
    ? differenceInDays(new Date(), parseISO(stats.latestDate))
    : null

  const hasBfData = chartData.some(
    (d) => d.bf_scale != null || d.bf_visual != null || d.bf_legacy != null,
  )

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Andamento
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            Trend peso & body fat
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Grafici dello storico misure, media mobile 7 punti, delta su più
            finestre temporali.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={() => setQuickOpen(true)}>
            <Scale className="h-4 w-4" />
            Pesati ora
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Peso attuale"
            value={`${stats.latest}`}
            unit="kg"
            hint={
              daysSinceLatest != null
                ? daysSinceLatest === 0
                  ? 'oggi'
                  : `${daysSinceLatest} giorni fa`
                : ''
            }
            primary
          />
          <DeltaTile label="Δ 7 giorni" delta={stats.delta7} />
          <DeltaTile label="Δ 30 giorni" delta={stats.delta30} />
          <DeltaTile label="Δ 90 giorni" delta={stats.delta90} />
          {stats.bfLatest != null && (
            <StatTile
              label="BF corrente"
              value={`${stats.bfLatest}`}
              unit="%"
            />
          )}
          {goalWeight != null && (
            <StatTile
              label="Target"
              value={`${goalWeight}`}
              unit="kg"
              hint={
                toGoal != null
                  ? `${toGoal > 0 ? '+' : ''}${toGoal} kg da fare`
                  : ''
              }
            />
          )}
        </div>
      ) : (
        !isLoading && (
          <div className="rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessuna misura ancora. Clicca "Pesati ora" per iniziare.
            </p>
          </div>
        )
      )}

      {/* Chart peso */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Peso</CardTitle>
            <CardDescription>
              Linea piena = peso misurato. Linea tratteggiata = media mobile
              7 punti (smussa le variazioni di idratazione).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Peso"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ma7"
                    name="Media 7 punti"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart body fat */}
      {hasBfData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Body fat</CardTitle>
            <CardDescription>
              Bilancia (bioimpedenza) vs visuale (stima da specchio/foto). Il
              visuale tende a essere più stabile; lo scale oscilla con
              idratazione.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 0, left: -8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    width={40}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(v) =>
                      v == null ? ['—', ''] : [`${v}%`, '']
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line
                    type="monotone"
                    dataKey="bf_scale"
                    name="BF bilancia"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--warning))' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="bf_visual"
                    name="BF visuale"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="bf_legacy"
                    name="BF (legacy)"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <QuickWeighDialog open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  )
}

// ============================================================
// Stat tiles
// ============================================================
function StatTile({
  label,
  value,
  unit,
  hint,
  primary,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  primary?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-xl font-semibold tabular',
          primary && 'text-primary',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function DeltaTile({
  label,
  delta,
}: {
  label: string
  delta: number | null
}) {
  if (delta == null) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-mono text-xl font-semibold tabular text-muted-foreground">
          —
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">dati insufficienti</p>
      </div>
    )
  }
  const isZero = Math.abs(delta) < 0.05
  const Icon = isZero ? Minus : delta > 0 ? TrendingUp : TrendingDown
  const color = isZero
    ? 'text-muted-foreground'
    : delta > 0
      ? 'text-warning'
      : 'text-primary'
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 inline-flex items-center gap-1 font-mono text-xl font-semibold tabular',
          color,
        )}
      >
        <Icon className="h-4 w-4" />
        {delta > 0 ? '+' : ''}
        {delta.toFixed(1)}
        <span className="text-xs font-normal text-muted-foreground">kg</span>
      </p>
    </div>
  )
}
