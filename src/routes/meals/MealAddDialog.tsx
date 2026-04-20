import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search, ScanLine, Pencil, ChefHat, ArrowLeft } from 'lucide-react'
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
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import { guessMealType, MEAL_TYPE_LABELS, round1 } from '@/lib/macro'
import { useAddMealEntry, type MealType } from '@/features/meals/useMeals'
import {
  useRecipes,
  recipePerServing,
  type Recipe,
} from '@/features/recipes/useRecipes'
import {
  FoodBarcodeTab,
  FoodManualTab,
  FoodSearchTab,
  MacroPreview,
  type PickedFood,
} from '@/components/food-picker/FoodPicker'

type Tab = 'search' | 'barcode' | 'manual' | 'recipe'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultMealType?: MealType
}

export function MealAddDialog({ open, onOpenChange, defaultMealType }: Props) {
  const [tab, setTab] = useState<Tab>('search')
  const [mealType, setMealType] = useState<MealType>(
    defaultMealType ?? guessMealType(),
  )
  const [eatenAt, setEatenAt] = useState(toLocalInputValue(new Date()))

  useEffect(() => {
    if (open) {
      setTab('search')
      setMealType(defaultMealType ?? guessMealType())
      setEatenAt(toLocalInputValue(new Date()))
    }
  }, [open, defaultMealType])

  const addMealEntry = useAddMealEntry()

  async function commit(p: PickedFood, recipe_id?: string | null, servings?: number | null) {
    try {
      await addMealEntry.mutateAsync({
        eaten_at: new Date(eatenAt).toISOString(),
        meal_type: mealType,
        food_name: p.food_name,
        food_id: p.food_id,
        recipe_id: recipe_id ?? null,
        grams: recipe_id ? null : p.grams,
        servings: servings ?? null,
        kcal: round1(p.kcal),
        protein_g: round1(p.protein_g),
        carb_g: round1(p.carb_g),
        fat_g: round1(p.fat_g),
        source: recipe_id ? 'recipe' : p.source,
      })
      toast.success(`Aggiunto: ${p.food_name}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiungi pasto</DialogTitle>
          <DialogDescription>
            Cerca, scansiona, inserisci manualmente o usa una tua ricetta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">Tipo di pasto</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((t) => (
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
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eaten_at">Quando</Label>
            <Input
              id="eaten_at"
              type="datetime-local"
              value={eatenAt}
              onChange={(e) => setEatenAt(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-background p-1">
          <TabButton icon={Search} label="Cerca" active={tab === 'search'} onClick={() => setTab('search')} />
          <TabButton icon={ScanLine} label="Barcode" active={tab === 'barcode'} onClick={() => setTab('barcode')} />
          <TabButton icon={Pencil} label="Rapido" active={tab === 'manual'} onClick={() => setTab('manual')} />
          <TabButton icon={ChefHat} label="Ricetta" active={tab === 'recipe'} onClick={() => setTab('recipe')} />
        </div>

        <div className="min-h-[200px]">
          {tab === 'search' && <FoodSearchTab onPicked={(p) => commit(p)} />}
          {tab === 'barcode' && <FoodBarcodeTab onPicked={(p) => commit(p)} />}
          {tab === 'manual' && <FoodManualTab onPicked={(p) => commit(p)} />}
          {tab === 'recipe' && <RecipePickerTab onPick={commit} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Search
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-sm py-2 text-xs transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

// ============================================================
// RECIPE PICKER TAB (specifico per meal logging)
// ============================================================
function RecipePickerTab({
  onPick,
}: {
  onPick: (
    p: PickedFood,
    recipe_id?: string | null,
    servings?: number | null,
  ) => Promise<void>
}) {
  const { data: recipes = [] } = useRecipes()
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState('1')

  if (recipes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Non hai ancora ricette. Creane una in{' '}
        <span className="font-semibold">Ricette</span>.
      </p>
    )
  }

  if (selected) {
    const per = recipePerServing(selected)
    const s = Math.max(0.1, num(servings) || 1)
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </Button>
          <div className="flex-1 text-sm font-semibold">{selected.name}</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="r_servings">Porzioni</Label>
          <Input
            id="r_servings"
            type="number"
            step="0.1"
            min="0.1"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="font-mono"
          />
        </div>

        <MacroPreview
          kcal={per.kcal * s}
          protein={per.protein * s}
          carb={per.carb * s}
          fat={per.fat * s}
        />

        <Button
          type="button"
          className="w-full"
          onClick={() =>
            onPick(
              {
                food_id: null,
                food_name: selected.name,
                grams: 0,
                kcal: per.kcal * s,
                protein_g: per.protein * s,
                carb_g: per.carb * s,
                fat_g: per.fat * s,
                source: 'manual',
              },
              selected.id,
              s,
            )
          }
        >
          Aggiungi al pasto
        </Button>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {recipes.map((r) => {
        const per = recipePerServing(r)
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-secondary"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.servings} porzioni · {(r.recipe_items ?? []).length} ingredienti
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs tabular text-muted-foreground">
                <div>{round1(per.kcal)} kcal/porz</div>
                <div>{round1(per.protein)}g P</div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
