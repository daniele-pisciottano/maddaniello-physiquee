import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Move } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { MEAL_TYPE_LABELS } from '@/lib/macro'
import {
  useUpdateMealEntry,
  type MealEntry,
  type MealType,
} from '@/features/meals/useMeals'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  entry: MealEntry | null
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MealEditDialog({ open, onOpenChange, entry }: Props) {
  const update = useUpdateMealEntry()
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [eatenAt, setEatenAt] = useState('')

  useEffect(() => {
    if (entry && open) {
      setMealType(entry.meal_type)
      setEatenAt(toLocalInputValue(new Date(entry.eaten_at)))
    }
  }, [entry, open])

  if (!entry) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!entry) return
    try {
      await update.mutateAsync({
        id: entry.id,
        patch: {
          meal_type: mealType,
          eaten_at: new Date(eatenAt).toISOString(),
        },
      })
      toast.success('Pasto spostato')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-4 w-4 text-primary" />
            Sposta pasto
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{entry.food_name}</span>
            {' · '}
            cambia data, ora e tipo di pasto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="me_when">Quando</Label>
            <Input
              id="me_when"
              type="datetime-local"
              value={eatenAt}
              onChange={(e) => setEatenAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo di pasto</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMealType(t)}
                    className={cn(
                      'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                      mealType === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {MEAL_TYPE_LABELS[t]}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio…
                </>
              ) : (
                <>
                  <Move className="h-4 w-4" />
                  Sposta
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
