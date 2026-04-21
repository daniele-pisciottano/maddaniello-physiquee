import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Check, Plus, Trash2 } from 'lucide-react'
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
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import {
  useAddSupplement,
  useDeleteSupplement,
  useDeleteSupplementLog,
  useLogSupplement,
  useSupplementLogToday,
  useSupplements,
  type Supplement,
} from '@/features/training/useSupplements'

export function SupplementsSection() {
  const { data: supplements = [] } = useSupplements()
  const { data: logToday = [] } = useSupplementLogToday()
  const addSupp = useAddSupplement()
  const delSupp = useDeleteSupplement()
  const logMutation = useLogSupplement()
  const delLog = useDeleteSupplementLog()

  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('g')

  async function handleAddSupplement(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nome richiesto')
      return
    }
    try {
      await addSupp.mutateAsync({
        name: name.trim(),
        dose: dose ? Number(dose) : null,
        unit: unit.trim() || null,
      })
      toast.success('Integratore aggiunto')
      setName('')
      setDose('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleLog(s: Supplement) {
    try {
      await logMutation.mutateAsync({
        supplement_id: s.id,
        supplement_name: s.name,
        dose: s.dose ?? null,
        unit: s.unit ?? null,
      })
      toast.success(`${s.name} loggato`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDeleteSupp(id: string) {
    if (
      !confirm(
        "Eliminare questo integratore? Lo storico dei log resta ma perde il riferimento.",
      )
    )
      return
    try {
      await delSupp.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDeleteLog(id: string) {
    try {
      await delLog.mutateAsync(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const loggedToday = new Set(
    logToday.map((l) => l.supplement_id).filter(Boolean) as string[],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integratori</CardTitle>
        <CardDescription>
          Elenca i tuoi integratori ricorrenti. Tap per loggarli oggi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add supplement to catalog */}
        <form onSubmit={handleAddSupplement} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sup_name">Nome</Label>
              <Input
                id="sup_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Creatina monoidrato"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup_dose">Dose</Label>
              <Input
                id="sup_dose"
                type="number"
                step="0.1"
                min="0"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="font-mono"
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup_unit">Unità</Label>
              <Input
                id="sup_unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="g, mg, UI…"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={addSupp.isPending}>
            <Plus className="h-4 w-4" />
            {addSupp.isPending ? 'Aggiunta…' : 'Aggiungi al catalogo'}
          </Button>
        </form>

        {supplements.length > 0 && <Separator />}

        {/* Catalog */}
        {supplements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Catalogo</h4>
            <ul className="grid gap-2 sm:grid-cols-2">
              {supplements.map((s) => {
                const taken = loggedToday.has(s.id)
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 rounded-md border px-3 py-2',
                      taken
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-background',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {s.name}
                      </div>
                      {s.dose != null && (
                        <div className="font-mono text-xs tabular text-muted-foreground">
                          {s.dose} {s.unit ?? ''}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={taken ? 'ghost' : 'default'}
                      onClick={() => handleLog(s)}
                      disabled={logMutation.isPending}
                    >
                      {taken ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Preso
                        </>
                      ) : (
                        'Logga oggi'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSupp(s.id)}
                      aria-label="Elimina"
                      disabled={delSupp.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {logToday.length > 0 && <Separator />}

        {/* Log of today */}
        {logToday.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Presi oggi</h4>
            <ul className="divide-y divide-border rounded-md border border-border">
              {logToday.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      {l.supplement_name}
                      {l.dose != null && (
                        <span className="ml-2 font-mono text-xs tabular text-muted-foreground">
                          {l.dose} {l.unit ?? ''}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] tabular text-muted-foreground">
                      {format(parseISO(l.taken_at), 'HH:mm', { locale: it })}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteLog(l.id)}
                    aria-label="Elimina log"
                    disabled={delLog.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {supplements.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Non hai ancora integratori nel catalogo.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
