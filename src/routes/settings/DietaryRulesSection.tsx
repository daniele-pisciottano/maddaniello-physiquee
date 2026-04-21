import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  formatRuleHumanReadable,
  RULE_TYPE_LABELS,
  ruleRequiresValue,
  useAddDietaryRule,
  useDeleteDietaryRule,
  useDietaryRules,
  useUpdateDietaryRule,
  type DietaryRuleType,
} from '@/features/rules/useDietaryRules'

export function DietaryRulesSection() {
  const { data: rules = [], isLoading } = useDietaryRules()
  const add = useAddDietaryRule()
  const update = useUpdateDietaryRule()
  const del = useDeleteDietaryRule()

  const [type, setType] = useState<DietaryRuleType>('max_per_week')
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('3')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!target.trim()) {
      toast.error('Specifica un alimento o categoria')
      return
    }
    const rule_value: Record<string, unknown> = { target: target.trim() }
    if (ruleRequiresValue(type)) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('Inserisci un valore numerico > 0')
        return
      }
      rule_value.value = n
    }
    try {
      await add.mutateAsync({
        rule_type: type,
        rule_value,
        notes: notes.trim() || null,
        active: true,
      })
      toast.success('Regola aggiunta')
      setTarget('')
      setValue('3')
      setNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await update.mutateAsync({ id, patch: { active: !current } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa regola?')) return
    try {
      await del.mutateAsync(id)
      toast.success('Regola eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const activeCount = rules.filter((r) => r.active).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regole alimentari</CardTitle>
        <CardDescription>
          Vincoli e preferenze che l'AI rispetta quando suggerisce pasti e quando
          analizza la settimana. {activeCount > 0 && `(${activeCount} attive)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form add */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule_type">Tipo di regola</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as DietaryRuleType)}
              >
                <SelectTrigger id="rule_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule_target">Alimento / categoria</Label>
              <Input
                id="rule_target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="es. carne, alcol, riso basmati"
              />
            </div>
          </div>

          {ruleRequiresValue(type) && (
            <div className="space-y-2">
              <Label htmlFor="rule_value">Quante volte</Label>
              <Input
                id="rule_value"
                type="number"
                min="1"
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono max-w-[120px]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rule_notes">Note (opz.)</Label>
            <Textarea
              id="rule_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="es. per ragioni etiche, intolleranza, preferenza…"
            />
          </div>

          <Button type="submit" disabled={add.isPending}>
            <Plus className="h-4 w-4" />
            {add.isPending ? 'Aggiunta…' : 'Aggiungi regola'}
          </Button>
        </form>

        {rules.length > 0 && <Separator />}

        {/* Lista */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna regola ancora. Aggiungine una qui sopra.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rules.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5',
                  !r.active && 'opacity-50',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {formatRuleHumanReadable(r)}
                  </div>
                  {r.notes && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.notes}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(r.id, r.active)}
                  disabled={update.isPending}
                >
                  {r.active ? 'Disattiva' : 'Attiva'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(r.id)}
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
