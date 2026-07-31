import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { useExercises } from '@/features/workout/useExercises'
import {
  useBestRecords,
  useMuscleVolume,
  useWeeklyVolume,
} from '@/features/workout/useWorkoutStats'
import { MUSCLE_ORDER, formatVolume, muscleLabel } from '@/features/workout/types'
import { ExerciseDetail } from './ExerciseDetail'

// Fuori range il colore deve dire subito da che parte si sbaglia:
// ambra sotto i 10 set, azzurro sopra i 20, primary dentro la fascia.
const COLOR_LOW = 'hsl(var(--warning))'
const COLOR_OK = 'hsl(var(--primary))'
const COLOR_HIGH = '#38bdf8'

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
}

export function StatsTab() {
  const { data: rows = [], isLoading, isError } = useMuscleVolume(8)
  const { data: volumeRows = [] } = useWeeklyVolume(8)
  const [detailId, setDetailId] = useState<string | null>(null)

  const latestWeek = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce(
      (max, r) => (r.week_start > max ? r.week_start : max),
      rows[0].week_start,
    )
  }, [rows])

  const setsData = useMemo(() => {
    if (!latestWeek) return []
    return rows
      .filter((r) => r.week_start === latestWeek)
      .map((r) => ({
        muscle: r.muscle,
        label: muscleLabel(r.muscle),
        sets: Number(r.sets),
      }))
      .sort((a, b) => {
        const ia = MUSCLE_ORDER.indexOf(a.muscle)
        const ib = MUSCLE_ORDER.indexOf(b.muscle)
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
      })
  }, [rows, latestWeek])

  const weeklyVolume = useMemo(
    () =>
      volumeRows.map((r) => ({
        week: r.week,
        label: format(parseISO(r.week), 'd MMM', { locale: it }),
        volume: Math.round(r.volumeKg),
      })),
    [volumeRows],
  )

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Non è stato possibile caricare le statistiche di volume. Controlla la
        connessione e riprova.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Volume settimanale per gruppo muscolare</CardTitle>
          <CardDescription>
            {latestWeek
              ? `Settimana del ${format(parseISO(latestWeek), 'd MMMM yyyy', { locale: it })}`
              : 'Nessuna settimana con dati'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {setsData.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nessuna serie registrata nelle ultime 8 settimane.
            </p>
          ) : (
            <div
              className="w-full"
              style={{ height: Math.max(240, setsData.length * 26) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={setsData}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <ReferenceArea
                    x1={10}
                    x2={20}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.08}
                  />
                  <ReferenceLine
                    x={10}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    x={20}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--secondary))', fillOpacity: 0.3 }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(v) => [`${v} serie`, '']}
                  />
                  <Bar dataKey="sets" radius={[0, 4, 4, 0]}>
                    {setsData.map((d) => (
                      <Cell
                        key={d.muscle}
                        fill={
                          d.sets < 10
                            ? COLOR_LOW
                            : d.sets > 20
                              ? COLOR_HIGH
                              : COLOR_OK
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Riferimento 10-20 serie a settimana per gruppo muscolare. Il muscolo
            primario conta 1 serie, i secondari 0,5.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Andamento volume totale</CardTitle>
          <CardDescription>
            Chili sollevati per settimana nelle ultime 8 settimane.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyVolume.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nessun volume registrato nel periodo.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeklyVolume}
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
                    width={52}
                    tickFormatter={(v) => formatVolume(Number(v))}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    formatter={(v) => [formatVolume(Number(v)), 'Volume']}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    name="Volume"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordsCard onOpenExercise={setDetailId} />

      <ExerciseDetail
        open={!!detailId}
        onOpenChange={(o) => {
          if (!o) setDetailId(null)
        }}
        exerciseId={detailId}
      />
    </div>
  )
}

function RecordsCard({
  onOpenExercise,
}: {
  onOpenExercise: (exerciseId: string) => void
}) {
  const { best, isError, isLoading } = useBestRecords()
  const { data: exercises = [], isError: exercisesError } = useExercises()

  const rows = useMemo(() => {
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    return [...best.values()]
      .filter((r) => r.record_type === 'est_1rm')
      .map((r) => ({
        id: r.id,
        exerciseId: r.exercise_id,
        name: names.get(r.exercise_id) ?? 'Esercizio rimosso',
        value: Number(r.value),
        weight: r.weight_kg != null ? Number(r.weight_kg) : null,
        reps: r.reps,
        achievedAt: r.achieved_at,
      }))
      .sort((a, b) => b.value - a.value)
  }, [best, exercises])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record personali</CardTitle>
        <CardDescription>
          Massimale stimato più alto per esercizio. Tocca una riga per aprire la
          scheda dell'esercizio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError || exercisesError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Non è stato possibile caricare i record personali.
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nessun record ancora. Vengono calcolati automaticamente alla chiusura
            di ogni seduta.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3 font-normal">Esercizio</th>
                  <th className="py-2 pr-3 text-right font-normal">1RM stim.</th>
                  <th className="py-2 pr-3 text-right font-normal">Serie</th>
                  <th className="py-2 text-right font-normal">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onOpenExercise(r.exerciseId)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary"
                  >
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular font-semibold text-primary">
                      {r.value} kg
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular text-muted-foreground">
                      {r.weight != null && r.reps != null
                        ? `${r.weight} × ${r.reps}`
                        : '—'}
                    </td>
                    <td className="py-2 text-right text-xs text-muted-foreground">
                      {format(parseISO(r.achievedAt), 'd MMM yyyy', {
                        locale: it,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
