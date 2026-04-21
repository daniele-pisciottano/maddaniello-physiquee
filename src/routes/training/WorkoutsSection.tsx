import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  useAddWorkout,
  useDeleteWorkout,
  useWorkouts,
  type WorkoutIntensity,
} from '@/features/training/useWorkouts'
import { useEstimateWorkoutKcal } from '@/features/training/useEstimateKcal'

const INTENSITY_LABELS: Record<WorkoutIntensity, string> = {
  low: 'Bassa',
  moderate: 'Media',
  high: 'Alta',
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function WorkoutsSection() {
  const { data: workouts = [] } = useWorkouts(10)
  const add = useAddWorkout()
  const del = useDeleteWorkout()
  const estimate = useEstimateWorkoutKcal()

  const [startedAt, setStartedAt] = useState(toLocalInputValue(new Date()))
  const [duration, setDuration] = useState('45')
  const [type, setType] = useState('Pesi')
  const [intensity, setIntensity] = useState<WorkoutIntensity>('moderate')
  const [kcal, setKcal] = useState('')
  const [notes, setNotes] = useState('')

  async function handleEstimateKcal() {
    const dur = Number(duration)
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error('Imposta prima una durata valida')
      return
    }
    if (!type.trim()) {
      toast.error('Imposta prima il tipo di allenamento')
      return
    }
    try {
      const res = await estimate.mutateAsync({
        workout_type: type.trim(),
        duration_min: Math.round(dur),
        intensity,
        notes: notes.trim() || null,
      })
      setKcal(String(res.kcal_burned))
      toast.success(`Stima: ${res.kcal_burned} kcal`, {
        description: res.reasoning,
        duration: 6000,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stima fallita')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const dur = Number(duration)
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error('Durata > 0')
      return
    }
    if (!type.trim()) {
      toast.error('Tipo richiesto')
      return
    }
    try {
      await add.mutateAsync({
        started_at: new Date(startedAt).toISOString(),
        duration_min: Math.round(dur),
        workout_type: type.trim(),
        intensity,
        kcal_burned: kcal ? Math.round(Number(kcal)) : null,
        notes: notes.trim() || null,
      })
      toast.success('Allenamento salvato')
      setDuration('45')
      setKcal('')
      setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo allenamento?')) return
    try {
      await del.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allenamenti</CardTitle>
        <CardDescription>
          Log rapido del tipo, durata e intensità. Le ultime 10 sessioni qui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="w_started">Quando</Label>
              <Input
                id="w_started"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w_type">Tipo</Label>
              <Input
                id="w_type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="es. Pesi, Corsa, Yoga"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="w_dur">Durata (min)</Label>
              <Input
                id="w_dur"
                type="number"
                min="1"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="w_int">Intensità</Label>
              <Select
                value={intensity}
                onValueChange={(v) => setIntensity(v as WorkoutIntensity)}
              >
                <SelectTrigger id="w_int">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INTENSITY_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="w_kcal">Kcal (opz.)</Label>
              <div className="flex gap-1">
                <Input
                  id="w_kcal"
                  type="number"
                  min="0"
                  step="1"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  placeholder="stima"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleEstimateKcal}
                  disabled={estimate.isPending}
                  aria-label="Stima con AI"
                  title="Stima kcal con AI"
                >
                  {estimate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="w_notes">Note / descrizione dettagliata (opz.)</Label>
            <Textarea
              id="w_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="es. pettorali + tricipiti: panca 4x8, spinte manubri 3x10, croci cavi 3x12 — descrivi per stima AI più accurata"
            />
          </div>
          <Button type="submit" disabled={add.isPending}>
            <Plus className="h-4 w-4" />
            {add.isPending ? 'Salvataggio…' : 'Aggiungi allenamento'}
          </Button>
        </form>

        {workouts.length > 0 && <Separator />}

        {workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun allenamento ancora. Aggiungine uno sopra.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {workouts.map((w) => (
              <li key={w.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{w.workout_type}</div>
                  <div className="font-mono text-xs tabular text-muted-foreground">
                    {format(parseISO(w.started_at), 'EEE d MMM · HH:mm', {
                      locale: it,
                    })}
                    {' · '}
                    {w.duration_min}min
                    {w.intensity && ` · ${INTENSITY_LABELS[w.intensity]}`}
                    {w.kcal_burned != null && ` · ~${w.kcal_burned} kcal`}
                  </div>
                  {w.notes && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {w.notes}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(w.id)}
                  aria-label="Elimina"
                  disabled={del.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
