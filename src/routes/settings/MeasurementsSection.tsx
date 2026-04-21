import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Separator } from '@/components/ui/Separator'
import {
  useAddMeasurement,
  useDeleteMeasurement,
  useMeasurements,
  type MeasurementInput,
} from '@/features/measurements/useMeasurements'

const today = () => new Date().toISOString().slice(0, 10)

const schema = z.object({
  measured_at: z.string().min(1, 'Obbligatoria'),
  weight_kg: z
    .union([z.coerce.number().min(20).max(400), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  body_fat_scale_pct: z
    .union([z.coerce.number().min(3).max(60), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  body_fat_visual_pct: z
    .union([z.coerce.number().min(3).max(60), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  waist_cm: z
    .union([z.coerce.number().min(30).max(200), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  chest_cm: z
    .union([z.coerce.number().min(40).max(200), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  arm_cm: z
    .union([z.coerce.number().min(15).max(80), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  thigh_cm: z
    .union([z.coerce.number().min(30).max(120), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  hips_cm: z
    .union([z.coerce.number().min(40).max(200), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  neck_cm: z
    .union([z.coerce.number().min(20).max(80), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  notes: z.string().nullable(),
})

type FormValues = z.input<typeof schema>

export function MeasurementsSection() {
  const { data: measurements = [], isLoading } = useMeasurements()
  const add = useAddMeasurement()
  const del = useDeleteMeasurement()
  const [expanded, setExpanded] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      measured_at: today(),
      weight_kg: null,
      body_fat_scale_pct: null,
      body_fat_visual_pct: null,
      waist_cm: null,
      chest_cm: null,
      arm_cm: null,
      thigh_cm: null,
      hips_cm: null,
      neck_cm: null,
      notes: null,
    },
  })

  const chartData = useMemo(() => {
    return measurements
      .filter((m) => m.weight_kg !== null)
      .slice()
      .reverse()
      .map((m) => ({
        date: m.measured_at,
        label: format(parseISO(m.measured_at), 'dd MMM', { locale: it }),
        weight: Number(m.weight_kg),
        bf: m.body_fat_pct !== null ? Number(m.body_fat_pct) : null,
      }))
  }, [measurements])

  async function onSubmit(values: FormValues) {
    const circumferences = {
      waist_cm: toNum(values.waist_cm),
      chest_cm: toNum(values.chest_cm),
      arm_cm: toNum(values.arm_cm),
      thigh_cm: toNum(values.thigh_cm),
      hips_cm: toNum(values.hips_cm),
      neck_cm: toNum(values.neck_cm),
    }
    const payload: MeasurementInput = {
      measured_at: values.measured_at,
      weight_kg: toNum(values.weight_kg),
      body_fat_scale_pct: toNum(values.body_fat_scale_pct),
      body_fat_visual_pct: toNum(values.body_fat_visual_pct),
      circumferences: Object.fromEntries(
        Object.entries(circumferences).filter(([, v]) => v !== null),
      ),
      notes: values.notes || null,
    }
    try {
      await add.mutateAsync(payload)
      toast.success('Misura salvata')
      form.reset({
        measured_at: today(),
        weight_kg: null,
        body_fat_scale_pct: null,
        body_fat_visual_pct: null,
        waist_cm: null,
        chest_cm: null,
        arm_cm: null,
        thigh_cm: null,
        hips_cm: null,
        neck_cm: null,
        notes: null,
      })
      setExpanded(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa misura?')) return
    try {
      await del.mutateAsync(id)
      toast.success('Misura eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Misure</CardTitle>
        <CardDescription>
          Storico peso, body fat e circonferenze. Il grafico mostra
          l'andamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grafico */}
        <div className="h-52 w-full">
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, bottom: 0, left: -12 }}
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
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(v: number) => [`${v} kg`, 'Peso']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              {isLoading
                ? 'Caricamento…'
                : chartData.length === 1
                  ? 'Servono almeno 2 misurazioni per disegnare l\'andamento.'
                  : 'Nessuna misura ancora. Aggiungine la prima qui sotto.'}
            </div>
          )}
        </div>

        <Separator />

        {/* Form aggiunta */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="measured_at">Data</Label>
            <Input
              id="measured_at"
              type="date"
              {...form.register('measured_at')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight_kg">Peso (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.1"
              placeholder="es. 75.3"
              {...form.register('weight_kg')}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body_fat_scale_pct">BF bilancia (%)</Label>
            <Input
              id="body_fat_scale_pct"
              type="number"
              step="0.1"
              placeholder="es. 16.5"
              {...form.register('body_fat_scale_pct')}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Letto dalla bilancia bioimpedenziometrica
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="body_fat_visual_pct">BF visuale (%)</Label>
            <Input
              id="body_fat_visual_pct"
              type="number"
              step="0.1"
              placeholder="es. 14"
              {...form.register('body_fat_visual_pct')}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Stima da specchio / foto / chart visivi
            </p>
          </div>

          {expanded && (
            <>
              <div className="space-y-2">
                <Label htmlFor="waist_cm">Vita (cm)</Label>
                <Input
                  id="waist_cm"
                  type="number"
                  step="0.1"
                  {...form.register('waist_cm')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chest_cm">Petto (cm)</Label>
                <Input
                  id="chest_cm"
                  type="number"
                  step="0.1"
                  {...form.register('chest_cm')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arm_cm">Braccio (cm)</Label>
                <Input
                  id="arm_cm"
                  type="number"
                  step="0.1"
                  {...form.register('arm_cm')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thigh_cm">Coscia (cm)</Label>
                <Input
                  id="thigh_cm"
                  type="number"
                  step="0.1"
                  {...form.register('thigh_cm')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hips_cm">Fianchi (cm)</Label>
                <Input
                  id="hips_cm"
                  type="number"
                  step="0.1"
                  {...form.register('hips_cm')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neck_cm">Collo (cm)</Label>
                <Input
                  id="neck_cm"
                  type="number"
                  step="0.1"
                  {...form.register('neck_cm')}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Come ti senti, condizioni…"
                  {...form.register('notes')}
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 sm:col-span-3">
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? 'Salvataggio…' : 'Aggiungi misura'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Nascondi dettagli' : 'Aggiungi circonferenze'}
            </Button>
          </div>
        </form>

        {/* Lista storica */}
        {measurements.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Storico</h4>
              <ul className="divide-y divide-border rounded-md border border-border">
                {measurements.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-4 px-4 py-3 text-sm"
                  >
                    <div className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                      {format(parseISO(m.measured_at), 'dd MMM yyyy', {
                        locale: it,
                      })}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono tabular">
                        {m.weight_kg !== null && (
                          <span>
                            <span className="text-muted-foreground">peso </span>
                            {m.weight_kg} kg
                          </span>
                        )}
                        {m.body_fat_visual_pct !== null && (
                          <span>
                            <span className="text-muted-foreground">bf vis </span>
                            {m.body_fat_visual_pct}%
                          </span>
                        )}
                        {m.body_fat_scale_pct !== null && (
                          <span>
                            <span className="text-muted-foreground">bf bil </span>
                            {m.body_fat_scale_pct}%
                          </span>
                        )}
                        {m.body_fat_visual_pct === null &&
                          m.body_fat_scale_pct === null &&
                          m.body_fat_pct !== null && (
                            <span>
                              <span className="text-muted-foreground">bf </span>
                              {m.body_fat_pct}%
                            </span>
                          )}
                        {Object.entries(m.circumferences ?? {}).map(
                          ([k, v]) =>
                            v != null && (
                              <span key={k}>
                                <span className="text-muted-foreground">
                                  {k.replace('_cm', '')}{' '}
                                </span>
                                {v} cm
                              </span>
                            ),
                        )}
                      </div>
                      {m.notes && (
                        <p className="text-xs text-muted-foreground">
                          {m.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                      disabled={del.isPending}
                      aria-label="Elimina"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
