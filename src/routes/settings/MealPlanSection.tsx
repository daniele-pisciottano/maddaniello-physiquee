import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
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
import { MEAL_TYPE_LABELS } from '@/lib/macro'
import type { MealType } from '@/features/meals/useMeals'
import {
  useAddMealPlanSlot,
  useDeleteMealPlanSlot,
  useMealPlanSlots,
  useUpdateMealPlanSlot,
  type MealPlanSlot,
} from '@/features/meal-plan/useMealPlan'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export function MealPlanSection() {
  const { data: slots = [] } = useMealPlanSlots()

  const byMealType = useMemo(() => {
    const map: Record<MealType, MealPlanSlot[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    }
    for (const s of slots) map[s.meal_type].push(s)
    return map
  }, [slots])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Piano alimentare</CardTitle>
        <CardDescription>
          Elenca gli alimenti previsti per ogni pasto, divisi in "slot"
          (carbo, proteine, ecc.) con alternative intercambiabili. L'AI
          userà questo piano per suggerirti pasti coerenti e vari.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {MEAL_ORDER.map((mt) => (
          <MealTypeBlock
            key={mt}
            mealType={mt}
            slots={byMealType[mt]}
            defaultPosition={byMealType[mt].length}
          />
        ))}

        {slots.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Nessuno slot ancora. Inizia da "Colazione" aggiungendo il primo
              slot sotto.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Blocco per meal_type
// ============================================================
function MealTypeBlock({
  mealType,
  slots,
  defaultPosition,
}: {
  mealType: MealType
  slots: MealPlanSlot[]
  defaultPosition: number
}) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{MEAL_TYPE_LABELS[mealType]}</h3>
        {!adding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi slot
          </Button>
        )}
      </div>

      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((s) => (
            <SlotRow key={s.id} slot={s} />
          ))}
        </ul>
      )}

      {adding && (
        <AddSlotForm
          mealType={mealType}
          defaultPosition={defaultPosition}
          onDone={() => setAdding(false)}
        />
      )}

      <Separator />
    </div>
  )
}

// ============================================================
// Riga slot (read-only + edit inline)
// ============================================================
function SlotRow({ slot }: { slot: MealPlanSlot }) {
  const update = useUpdateMealPlanSlot()
  const del = useDeleteMealPlanSlot()
  const [editing, setEditing] = useState(false)

  async function handleToggle() {
    try {
      await update.mutateAsync({ id: slot.id, patch: { active: !slot.active } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questo slot?')) return
    try {
      await del.mutateAsync(slot.id)
      toast.success('Slot eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  if (editing) {
    return (
      <EditSlotForm slot={slot} onDone={() => setEditing(false)} />
    )
  }

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-md border border-border bg-background/50 px-3 py-2.5',
        !slot.active && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-widest text-primary">
            {slot.slot_label}
          </span>
          {slot.portion_hint && (
            <span className="font-mono text-[10px] tabular text-muted-foreground">
              {slot.portion_hint}
            </span>
          )}
        </div>
        <div className="text-sm">
          {slot.options.length > 0 ? (
            slot.options.map((opt, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground"> · </span>}
                {opt}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">(vuoto)</span>
          )}
        </div>
        {slot.notes && (
          <div className="text-xs text-muted-foreground">{slot.notes}</div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setEditing(true)}
        aria-label="Modifica"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={update.isPending}
      >
        {slot.active ? 'Off' : 'On'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        aria-label="Elimina"
        disabled={del.isPending}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </li>
  )
}

// ============================================================
// Form: Add
// ============================================================
function AddSlotForm({
  mealType,
  defaultPosition,
  onDone,
}: {
  mealType: MealType
  defaultPosition: number
  onDone: () => void
}) {
  const add = useAddMealPlanSlot()
  const [label, setLabel] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [portion, setPortion] = useState('')
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return toast.error('Label richiesta (es. Carbo)')
    const options = parseOptions(optionsText)
    if (options.length === 0)
      return toast.error('Inserisci almeno un alimento')
    try {
      await add.mutateAsync({
        meal_type: mealType,
        slot_label: label.trim(),
        options,
        portion_hint: portion.trim() || null,
        notes: notes.trim() || null,
        position: defaultPosition,
        active: true,
      })
      toast.success('Slot aggiunto')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`mp_label_${mealType}`} className="text-xs">
            Slot (es. Carbo)
          </Label>
          <Input
            id={`mp_label_${mealType}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Carbo"
            autoFocus
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`mp_portion_${mealType}`} className="text-xs">
            Porzione (opz.)
          </Label>
          <Input
            id={`mp_portion_${mealType}`}
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
            placeholder="es. 40-60g, 150ml, a volontà"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`mp_options_${mealType}`} className="text-xs">
          Alternative (separate da virgola o a capo)
        </Label>
        <Textarea
          id={`mp_options_${mealType}`}
          rows={2}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          placeholder="fiocchi d'avena, fette biscottate, cereali integrali"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`mp_notes_${mealType}`} className="text-xs">
          Note (opz.)
        </Label>
        <Input
          id={`mp_notes_${mealType}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="es. preferibilmente integrali"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={add.isPending}>
          <Check className="h-3.5 w-3.5" />
          {add.isPending ? 'Aggiunta…' : 'Aggiungi'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
          Annulla
        </Button>
      </div>
    </form>
  )
}

// ============================================================
// Form: Edit
// ============================================================
function EditSlotForm({
  slot,
  onDone,
}: {
  slot: MealPlanSlot
  onDone: () => void
}) {
  const update = useUpdateMealPlanSlot()
  const [label, setLabel] = useState(slot.slot_label)
  const [optionsText, setOptionsText] = useState(slot.options.join(', '))
  const [portion, setPortion] = useState(slot.portion_hint ?? '')
  const [notes, setNotes] = useState(slot.notes ?? '')
  const [mealType, setMealType] = useState<MealType>(slot.meal_type)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return toast.error('Label richiesta')
    const options = parseOptions(optionsText)
    if (options.length === 0) return toast.error('Inserisci almeno un alimento')
    try {
      await update.mutateAsync({
        id: slot.id,
        patch: {
          meal_type: mealType,
          slot_label: label.trim(),
          options,
          portion_hint: portion.trim() || null,
          notes: notes.trim() || null,
        },
      })
      toast.success('Slot aggiornato')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Pasto</Label>
          <Select
            value={mealType}
            onValueChange={(v) => setMealType(v as MealType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_ORDER.map((m) => (
                <SelectItem key={m} value={m}>
                  {MEAL_TYPE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Slot</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Porzione</Label>
          <Input value={portion} onChange={(e) => setPortion(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Alternative (separate da virgola)</Label>
        <Textarea
          rows={2}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={update.isPending}>
          <Check className="h-3.5 w-3.5" />
          {update.isPending ? 'Salvataggio…' : 'Salva'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          <X className="h-3.5 w-3.5" />
          Annulla
        </Button>
      </div>
    </form>
  )
}

function parseOptions(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
