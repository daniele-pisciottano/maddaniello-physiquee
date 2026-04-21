import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
  useDeleteSleep,
  useSleepEntries,
  useUpsertSleep,
} from '@/features/training/useSleep'
import { cn } from '@/lib/utils'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SleepSection() {
  const { data: entries = [] } = useSleepEntries(14)
  const save = useUpsertSleep()
  const del = useDeleteSleep()

  const [date, setDate] = useState(today())
  const [hours, setHours] = useState('7.5')
  const [quality, setQuality] = useState<number>(3)
  const [bedtime, setBedtime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [notes, setNotes] = useState('')

  const existing = useMemo(
    () => entries.find((e) => e.sleep_date === date),
    [entries, date],
  )

  // Auto-fill form when switching date and a record exists
  const [lastSyncedDate, setLastSyncedDate] = useState<string | null>(null)
  if (lastSyncedDate !== date) {
    setLastSyncedDate(date)
    if (existing) {
      setHours(String(existing.hours))
      setQuality(existing.quality ?? 3)
      setBedtime(existing.bedtime ?? '')
      setWakeTime(existing.wake_time ?? '')
      setNotes(existing.notes ?? '')
    } else {
      setHours('7.5')
      setQuality(3)
      setBedtime('')
      setWakeTime('')
      setNotes('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const h = Number(hours)
    if (!Number.isFinite(h) || h <= 0 || h >= 24) {
      toast.error('Ore non valide')
      return
    }
    try {
      await save.mutateAsync({
        sleep_date: date,
        hours: h,
        quality,
        bedtime: bedtime.trim() || null,
        wake_time: wakeTime.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success('Sonno salvato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa notte?')) return
    try {
      await del.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const avgHours =
    entries.length > 0
      ? (
          entries.reduce((s, e) => s + Number(e.hours), 0) / entries.length
        ).toFixed(1)
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sonno</CardTitle>
        <CardDescription>
          Un'entry per notte (data = risveglio). Solo 14 giorni visualizzati.
          {avgHours && ` Media: ${avgHours}h.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s_date">Data risveglio</Label>
              <Input
                id="s_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {existing && (
                <p className="text-[10px] text-primary">
                  Esiste già per questa data — modifichi.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_hours">Ore dormite</Label>
              <Input
                id="s_hours"
                type="number"
                step="0.1"
                min="0.5"
                max="23"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Qualità</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuality(n)}
                  className={cn(
                    'h-9 flex-1 rounded-md border text-sm font-medium transition-colors',
                    quality === n
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              1 = pessima · 3 = normale · 5 = eccellente
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s_bedtime">Ora letto (opz.)</Label>
              <Input
                id="s_bedtime"
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_wake">Ora sveglia (opz.)</Label>
              <Input
                id="s_wake"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s_notes">Note (opz.)</Label>
            <Textarea
              id="s_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="es. sveglie notturne, caffè tardivo"
            />
          </div>

          <Button type="submit" disabled={save.isPending}>
            <Plus className="h-4 w-4" />
            {save.isPending ? 'Salvataggio…' : existing ? 'Aggiorna' : 'Aggiungi'}
          </Button>
        </form>

        {entries.length > 0 && <Separator />}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna notte registrata. Inizia da stanotte!
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-medium tabular">
                    {format(parseISO(e.sleep_date), 'EEE d MMM', { locale: it })}
                    {' · '}
                    {e.hours}h
                    {e.quality != null && ` · ${'★'.repeat(e.quality)}`}
                  </div>
                  {(e.bedtime || e.wake_time) && (
                    <div className="text-xs text-muted-foreground">
                      {e.bedtime && `letto ${e.bedtime}`}
                      {e.bedtime && e.wake_time && ' · '}
                      {e.wake_time && `sveglia ${e.wake_time}`}
                    </div>
                  )}
                  {e.notes && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {e.notes}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(e.id)}
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
