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
import { guessMealType, MEAL_TYPE_LABELS, scaleForGrams, round1, kcalFromMacros } from '@/lib/macro'
import { offProductByBarcode, offSearch, type OffFood } from '@/lib/off'
import { useAddMealEntry, type MealType } from '@/features/meals/useMeals'
import { useFoods, useAddFood, type Food } from '@/features/foods/useFoods'
import { useRecipes, recipePerServing, type Recipe } from '@/features/recipes/useRecipes'
import { BarcodeScanner } from '@/components/BarcodeScanner'

type Tab = 'search' | 'barcode' | 'manual' | 'recipe'

type SelectedFood =
  | { kind: 'local'; food: Food }
  | { kind: 'off'; food: OffFood }

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

  // Quando apre il dialog, re-init dei defaults
  useEffect(() => {
    if (open) {
      setTab('search')
      setMealType(defaultMealType ?? guessMealType())
      setEatenAt(toLocalInputValue(new Date()))
    }
  }, [open, defaultMealType])

  function close() {
    onOpenChange(false)
  }

  const addMealEntry = useAddMealEntry()

  async function addEntry(payload: {
    food_name: string
    kcal: number
    protein_g: number
    carb_g: number
    fat_g: number
    grams?: number | null
    servings?: number | null
    food_id?: string | null
    recipe_id?: string | null
    source: 'manual' | 'barcode' | 'recipe'
  }) {
    try {
      await addMealEntry.mutateAsync({
        eaten_at: new Date(eatenAt).toISOString(),
        meal_type: mealType,
        food_name: payload.food_name,
        food_id: payload.food_id ?? null,
        recipe_id: payload.recipe_id ?? null,
        grams: payload.grams ?? null,
        servings: payload.servings ?? null,
        kcal: round1(payload.kcal),
        protein_g: round1(payload.protein_g),
        carb_g: round1(payload.carb_g),
        fat_g: round1(payload.fat_g),
        source: payload.source,
      })
      toast.success(`Aggiunto: ${payload.food_name}`)
      close()
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

        {/* Meal type + datetime */}
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

        {/* Tab selector */}
        <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-background p-1">
          <TabButton icon={Search} label="Cerca" active={tab === 'search'} onClick={() => setTab('search')} />
          <TabButton icon={ScanLine} label="Barcode" active={tab === 'barcode'} onClick={() => setTab('barcode')} />
          <TabButton icon={Pencil} label="Rapido" active={tab === 'manual'} onClick={() => setTab('manual')} />
          <TabButton icon={ChefHat} label="Ricetta" active={tab === 'recipe'} onClick={() => setTab('recipe')} />
        </div>

        <div className="min-h-[200px]">
          {tab === 'search' && <SearchTab onAdd={addEntry} />}
          {tab === 'barcode' && <BarcodeTab onAdd={addEntry} />}
          {tab === 'manual' && <ManualTab onAdd={addEntry} />}
          {tab === 'recipe' && <RecipeTab onAdd={addEntry} />}
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
// SEARCH TAB
// ============================================================
type AddFn = (p: {
  food_name: string
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  grams?: number | null
  servings?: number | null
  food_id?: string | null
  recipe_id?: string | null
  source: 'manual' | 'barcode' | 'recipe'
}) => Promise<void>

function SearchTab({ onAdd }: { onAdd: AddFn }) {
  const [query, setQuery] = useState('')
  const { data: localFoods = [] } = useFoods(query.length >= 1 ? query : undefined)
  const [offResults, setOffResults] = useState<OffFood[] | null>(null)
  const [offLoading, setOffLoading] = useState(false)
  const [selected, setSelected] = useState<SelectedFood | null>(null)

  async function handleOffSearch() {
    if (!query.trim()) return
    setOffLoading(true)
    try {
      const res = await offSearch(query)
      setOffResults(res)
      if (res.length === 0) toast.info('Nessun risultato su Open Food Facts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore OFF')
    } finally {
      setOffLoading(false)
    }
  }

  if (selected) {
    return (
      <FoodGramsPicker
        selected={selected}
        onBack={() => setSelected(null)}
        onConfirm={(grams) => {
          const per100 =
            selected.kind === 'local'
              ? {
                  kcal: Number(selected.food.kcal_100g),
                  protein: Number(selected.food.protein_100g),
                  carb: Number(selected.food.carb_100g),
                  fat: Number(selected.food.fat_100g),
                }
              : {
                  kcal: selected.food.kcal_100g,
                  protein: selected.food.protein_100g,
                  carb: selected.food.carb_100g,
                  fat: selected.food.fat_100g,
                }
          const scaled = scaleForGrams(per100, grams)
          return onAdd({
            food_name:
              selected.kind === 'local'
                ? selected.food.name
                : `${selected.food.name}${selected.food.brand ? ` · ${selected.food.brand}` : ''}`,
            food_id: selected.kind === 'local' ? selected.food.id : null,
            grams,
            kcal: scaled.kcal,
            protein_g: scaled.protein,
            carb_g: scaled.carb,
            fat_g: scaled.fat,
            source: selected.kind === 'off' ? 'barcode' : 'manual',
          })
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Cerca alimento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim().length >= 2) {
              e.preventDefault()
              handleOffSearch()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleOffSearch}
          disabled={offLoading || query.trim().length < 2}
        >
          {offLoading ? '…' : 'Cerca su OFF'}
        </Button>
      </div>

      {/* Local custom foods */}
      {localFoods.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            I tuoi alimenti
          </p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {localFoods.slice(0, 8).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: 'local', food: f })}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    {f.brand && (
                      <div className="truncate text-xs text-muted-foreground">
                        {f.brand}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                    {Number(f.kcal_100g).toFixed(0)} kcal/100g
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OFF results */}
      {offResults !== null && offResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Open Food Facts ({offResults.length})
          </p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {offResults.map((f) => (
              <li key={f.barcode}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: 'off', food: f })}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    {f.brand && (
                      <div className="truncate text-xs text-muted-foreground">
                        {f.brand}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                    {f.kcal_100g.toFixed(0)} kcal/100g
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query.length >= 2 &&
        localFoods.length === 0 &&
        offResults === null && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nessun alimento locale. Usa "Cerca su OFF" o il tab Rapido per inserirlo.
          </p>
        )}
    </div>
  )
}

// ============================================================
// BARCODE TAB
// ============================================================
function BarcodeTab({ onAdd }: { onAdd: AddFn }) {
  const [food, setFood] = useState<OffFood | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [looking, setLooking] = useState(false)

  async function handleDetected(code: string) {
    if (looking || food) return
    setLooking(true)
    setNotFound(false)
    try {
      const res = await offProductByBarcode(code)
      if (!res) {
        setNotFound(true)
        toast.warning(`Barcode ${code}: non trovato su OFF`)
      } else {
        setFood(res)
        toast.success('Prodotto trovato')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore OFF')
    } finally {
      setLooking(false)
    }
  }

  if (food) {
    return (
      <FoodGramsPicker
        selected={{ kind: 'off', food }}
        onBack={() => {
          setFood(null)
          setNotFound(false)
        }}
        onConfirm={(grams) => {
          const scaled = scaleForGrams(
            {
              kcal: food.kcal_100g,
              protein: food.protein_100g,
              carb: food.carb_100g,
              fat: food.fat_100g,
            },
            grams,
          )
          return onAdd({
            food_name: `${food.name}${food.brand ? ` · ${food.brand}` : ''}`,
            grams,
            kcal: scaled.kcal,
            protein_g: scaled.protein,
            carb_g: scaled.carb,
            fat_g: scaled.fat,
            source: 'barcode',
          })
        }}
      />
    )
  }

  return (
    <div className="space-y-2">
      <BarcodeScanner onDetected={handleDetected} />
      {looking && <p className="text-sm text-muted-foreground">Ricerca su OFF…</p>}
      {notFound && (
        <p className="text-sm text-warning">
          Prodotto non trovato. Usa il tab Rapido per inserirlo manualmente.
        </p>
      )}
    </div>
  )
}

// ============================================================
// MANUAL TAB
// ============================================================
function ManualTab({ onAdd }: { onAdd: AddFn }) {
  const [name, setName] = useState('')
  const [grams, setGrams] = useState<string>('100')
  const [kcal, setKcal] = useState<string>('')
  const [protein, setProtein] = useState<string>('')
  const [carb, setCarb] = useState<string>('')
  const [fat, setFat] = useState<string>('')
  const [saveAsFood, setSaveAsFood] = useState(false)
  const addFood = useAddFood()

  const p = num(protein)
  const c = num(carb)
  const f = num(fat)
  const g = num(grams)
  const computedKcal = kcalFromMacros(p, c, f)
  const kcalShown = num(kcal) > 0 ? num(kcal) : round1(computedKcal)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Nome richiesto')
    if (g <= 0) return toast.error('Grammi > 0')
    if (kcalShown <= 0) return toast.error('Inserisci kcal o macro')

    if (saveAsFood && g > 0) {
      // Ricostruisci i valori per 100g
      const factor = 100 / g
      try {
        await addFood.mutateAsync({
          name: name.trim(),
          source: 'custom',
          kcal_100g: round1(kcalShown * factor),
          protein_100g: round1(p * factor),
          carb_100g: round1(c * factor),
          fat_100g: round1(f * factor),
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore salvataggio custom')
        return
      }
    }

    await onAdd({
      food_name: name.trim(),
      grams: g,
      kcal: kcalShown,
      protein_g: p,
      carb_g: c,
      fat_g: f,
      source: 'manual',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="m_name">Nome</Label>
        <Input
          id="m_name"
          placeholder="es. Panino tonno"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        <FieldMini id="m_g" label="Grammi" value={grams} onChange={setGrams} />
        <FieldMini id="m_k" label="Kcal" value={kcal} onChange={setKcal} placeholder={round1(computedKcal).toString()} />
        <FieldMini id="m_p" label="Prot (g)" value={protein} onChange={setProtein} />
        <FieldMini id="m_c" label="Carb (g)" value={carb} onChange={setCarb} />
        <FieldMini id="m_f" label="Grassi (g)" value={fat} onChange={setFat} />
      </div>

      {kcal === '' && computedKcal > 0 && (
        <p className="text-xs text-muted-foreground">
          Kcal calcolate dai macro: <span className="font-mono">{round1(computedKcal)}</span> (P·4 + C·4 + G·9).
          Scrivi un valore diverso per usarlo.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={saveAsFood}
          onChange={(e) => setSaveAsFood(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-background accent-primary"
        />
        Salva come alimento custom riutilizzabile
      </label>

      <Button type="submit" className="w-full">
        Aggiungi al pasto
      </Button>
    </form>
  )
}

function FieldMini({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-2 font-mono"
      />
    </div>
  )
}

// ============================================================
// RECIPE TAB
// ============================================================
function RecipeTab({ onAdd }: { onAdd: AddFn }) {
  const { data: recipes = [] } = useRecipes()
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState('1')

  if (recipes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Non hai ancora ricette. Creane una in <span className="font-semibold">Ricette</span>.
      </p>
    )
  }

  if (selected) {
    const per = recipePerServing(selected)
    const s = Math.max(0.1, num(servings) || 1)
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
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
            onAdd({
              food_name: selected.name,
              recipe_id: selected.id,
              servings: s,
              kcal: per.kcal * s,
              protein_g: per.protein * s,
              carb_g: per.carb * s,
              fat_g: per.fat * s,
              source: 'recipe',
            })
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

// ============================================================
// SHARED: picker grammi + preview macro
// ============================================================
function FoodGramsPicker({
  selected,
  onBack,
  onConfirm,
}: {
  selected: SelectedFood
  onBack: () => void
  onConfirm: (grams: number) => Promise<void>
}) {
  const [grams, setGrams] = useState<string>(
    selected.kind === 'local' && selected.food.serving_g
      ? String(selected.food.serving_g)
      : selected.kind === 'off' && selected.food.serving_g
        ? String(selected.food.serving_g)
        : '100',
  )
  const per100 =
    selected.kind === 'local'
      ? {
          kcal: Number(selected.food.kcal_100g),
          protein: Number(selected.food.protein_100g),
          carb: Number(selected.food.carb_100g),
          fat: Number(selected.food.fat_100g),
        }
      : {
          kcal: selected.food.kcal_100g,
          protein: selected.food.protein_100g,
          carb: selected.food.carb_100g,
          fat: selected.food.fat_100g,
        }
  const g = num(grams)
  const scaled = scaleForGrams(per100, g > 0 ? g : 0)

  const name =
    selected.kind === 'local'
      ? selected.food.name
      : selected.food.name
  const brand =
    selected.kind === 'local' ? selected.food.brand : selected.food.brand

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          {brand && (
            <div className="truncate text-xs text-muted-foreground">{brand}</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fp_grams">Grammi</Label>
        <Input
          id="fp_grams"
          type="number"
          step="1"
          min="1"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="font-mono"
          autoFocus
        />
      </div>

      <MacroPreview
        kcal={scaled.kcal}
        protein={scaled.protein}
        carb={scaled.carb}
        fat={scaled.fat}
      />

      <Button
        type="button"
        className="w-full"
        onClick={() => onConfirm(g)}
        disabled={g <= 0}
      >
        Aggiungi al pasto
      </Button>
    </div>
  )
}

function MacroPreview({
  kcal,
  protein,
  carb,
  fat,
}: {
  kcal: number
  protein: number
  carb: number
  fat: number
}) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-md border border-border bg-background/50 p-3 font-mono text-xs tabular">
      <Stat label="Kcal" value={round1(kcal)} primary />
      <Stat label="P" value={`${round1(protein)}g`} />
      <Stat label="C" value={`${round1(carb)}g`} />
      <Stat label="G" value={`${round1(fat)}g`} />
    </div>
  )
}

function Stat({
  label,
  value,
  primary,
}: {
  label: string
  value: string | number
  primary?: boolean
}) {
  return (
    <div className="space-y-0.5 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={cn('font-semibold', primary && 'text-primary')}>{value}</div>
    </div>
  )
}

// Utils -------------------------------------------------------
function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
