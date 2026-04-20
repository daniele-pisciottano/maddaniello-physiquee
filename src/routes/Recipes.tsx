import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
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
  recipePerServing,
  recipeTotals,
  useDeleteRecipe,
  useRecipes,
  useSaveRecipe,
  type Recipe,
  type RecipeItemInput,
} from '@/features/recipes/useRecipes'
import { useFoods, type Food } from '@/features/foods/useFoods'
import { round0, round1, scaleForGrams } from '@/lib/macro'

export function Recipes() {
  const { data: recipes = [], isLoading } = useRecipes()
  const deleteRecipe = useDeleteRecipe()
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa ricetta? I pasti già loggati restano.')) return
    try {
      await deleteRecipe.mutateAsync(id)
      toast.success('Ricetta eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Ricette
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            I miei pasti composti
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea combinazioni riutilizzabili. Aggiungile ai pasti in 2 tap.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nuova
        </Button>
      </div>

      {recipes.length === 0 && !isLoading ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Non hai ancora ricette. Creane una per la tua colazione tipo, il pranzo del lunedì, etc.
          </p>
          <Button type="button" className="mt-4" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Crea la prima
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map((r) => {
            const per = recipePerServing(r)
            const total = recipeTotals(r.recipe_items ?? [])
            return (
              <Card key={r.id}>
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{r.name}</CardTitle>
                      <CardDescription>
                        {r.servings} porzioni · {(r.recipe_items ?? []).length} ingredienti
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(r)}
                        aria-label="Modifica"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(r.id)}
                        aria-label="Elimina"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 rounded-md bg-background/50 p-3 font-mono text-xs tabular">
                    <MiniStat label="kcal/porz" value={round0(per.kcal)} primary />
                    <MiniStat label="P" value={`${round0(per.protein)}g`} />
                    <MiniStat label="C" value={`${round0(per.carb)}g`} />
                    <MiniStat label="G" value={`${round0(per.fat)}g`} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Totale: {round0(total.kcal)} kcal · {round0(total.protein)}g P
                  </div>
                  {(r.recipe_items ?? []).length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {(r.recipe_items ?? []).slice(0, 4).map((it) => (
                        <li key={it.id} className="flex justify-between gap-2">
                          <span className="truncate">{it.food_name_snapshot}</span>
                          <span className="font-mono tabular shrink-0">
                            {round0(Number(it.grams))}g
                          </span>
                        </li>
                      ))}
                      {(r.recipe_items ?? []).length > 4 && (
                        <li className="text-[10px] italic">
                          +{(r.recipe_items ?? []).length - 4} altri…
                        </li>
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {creating && (
        <RecipeEditDialog
          open={creating}
          onOpenChange={setCreating}
          recipe={null}
        />
      )}
      {editing && (
        <RecipeEditDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          recipe={editing}
        />
      )}
    </div>
  )
}

function MiniStat({
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
      <div
        className={'font-semibold ' + (primary ? 'text-primary' : 'text-foreground')}
      >
        {value}
      </div>
    </div>
  )
}

// ============================================================
// Edit dialog
// ============================================================

type DraftItem = RecipeItemInput & { _key: string }

function RecipeEditDialog({
  open,
  onOpenChange,
  recipe,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  recipe: Recipe | null
}) {
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(String(recipe?.servings ?? 1))
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [items, setItems] = useState<DraftItem[]>(() =>
    (recipe?.recipe_items ?? []).map((it) => ({
      _key: it.id,
      food_id: it.food_id,
      food_name_snapshot: it.food_name_snapshot,
      grams: Number(it.grams),
      kcal_snapshot: Number(it.kcal_snapshot),
      protein_snapshot: Number(it.protein_snapshot),
      carb_snapshot: Number(it.carb_snapshot),
      fat_snapshot: Number(it.fat_snapshot),
    })),
  )

  const save = useSaveRecipe()
  const { data: customFoods = [] } = useFoods()

  useEffect(() => {
    if (open) {
      setName(recipe?.name ?? '')
      setServings(String(recipe?.servings ?? 1))
      setNotes(recipe?.notes ?? '')
      setItems(
        (recipe?.recipe_items ?? []).map((it) => ({
          _key: it.id,
          food_id: it.food_id,
          food_name_snapshot: it.food_name_snapshot,
          grams: Number(it.grams),
          kcal_snapshot: Number(it.kcal_snapshot),
          protein_snapshot: Number(it.protein_snapshot),
          carb_snapshot: Number(it.carb_snapshot),
          fat_snapshot: Number(it.fat_snapshot),
        })),
      )
    }
  }, [open, recipe])

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => ({
          kcal: acc.kcal + it.kcal_snapshot,
          protein: acc.protein + it.protein_snapshot,
          carb: acc.carb + it.carb_snapshot,
          fat: acc.fat + it.fat_snapshot,
        }),
        { kcal: 0, protein: 0, carb: 0, fat: 0 },
      ),
    [items],
  )

  const s = Math.max(1, parseInt(servings) || 1)

  function addEmptyRow() {
    setItems((cur) => [
      ...cur,
      {
        _key: Math.random().toString(36).slice(2),
        food_id: null,
        food_name_snapshot: '',
        grams: 0,
        kcal_snapshot: 0,
        protein_snapshot: 0,
        carb_snapshot: 0,
        fat_snapshot: 0,
      },
    ])
  }

  function addFromFood(food: Food) {
    const grams = 100
    const scaled = scaleForGrams(
      {
        kcal: Number(food.kcal_100g),
        protein: Number(food.protein_100g),
        carb: Number(food.carb_100g),
        fat: Number(food.fat_100g),
      },
      grams,
    )
    setItems((cur) => [
      ...cur,
      {
        _key: Math.random().toString(36).slice(2),
        food_id: food.id,
        food_name_snapshot: food.name,
        grams,
        kcal_snapshot: scaled.kcal,
        protein_snapshot: scaled.protein,
        carb_snapshot: scaled.carb,
        fat_snapshot: scaled.fat,
      },
    ])
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((cur) =>
      cur.map((it) => (it._key === key ? { ...it, ...patch } : it)),
    )
  }

  // Se un item ha food_id (collegato ad alimento custom), ricalcola macro
  // quando cambiano i grammi
  function updateGramsFromFood(key: string, newGrams: number) {
    setItems((cur) =>
      cur.map((it) => {
        if (it._key !== key) return it
        if (!it.food_id) {
          return { ...it, grams: newGrams }
        }
        const food = customFoods.find((f) => f.id === it.food_id)
        if (!food) return { ...it, grams: newGrams }
        const scaled = scaleForGrams(
          {
            kcal: Number(food.kcal_100g),
            protein: Number(food.protein_100g),
            carb: Number(food.carb_100g),
            fat: Number(food.fat_100g),
          },
          newGrams,
        )
        return {
          ...it,
          grams: newGrams,
          kcal_snapshot: scaled.kcal,
          protein_snapshot: scaled.protein,
          carb_snapshot: scaled.carb,
          fat_snapshot: scaled.fat,
        }
      }),
    )
  }

  function removeItem(key: string) {
    setItems((cur) => cur.filter((it) => it._key !== key))
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Nome richiesto')
    const cleanItems = items.filter(
      (it) => it.food_name_snapshot.trim() && it.grams > 0,
    )
    if (cleanItems.length === 0) return toast.error('Aggiungi almeno un ingrediente')
    try {
      await save.mutateAsync({
        id: recipe?.id,
        name: name.trim(),
        servings: s,
        notes: notes.trim() || null,
        items: cleanItems.map((it) => ({
          food_id: it.food_id,
          food_name_snapshot: it.food_name_snapshot,
          grams: it.grams,
          kcal_snapshot: it.kcal_snapshot,
          protein_snapshot: it.protein_snapshot,
          carb_snapshot: it.carb_snapshot,
          fat_snapshot: it.fat_snapshot,
        })),
      })
      toast.success(recipe ? 'Ricetta aggiornata' : 'Ricetta creata')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {recipe ? 'Modifica ricetta' : 'Nuova ricetta'}
          </DialogTitle>
          <DialogDescription>
            Dai un nome, specifica le porzioni totali, e aggiungi gli
            ingredienti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="r_name">Nome</Label>
              <Input
                id="r_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Pollo e riso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r_servings">Porzioni</Label>
              <Input
                id="r_servings"
                type="number"
                min="1"
                step="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r_notes">Note (opz.)</Label>
            <Textarea
              id="r_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preparazione, varianti…"
            />
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Ingredienti</h4>
              <div className="flex items-center gap-2">
                {customFoods.length > 0 && (
                  <Select
                    onValueChange={(val) => {
                      const f = customFoods.find((x) => x.id === val)
                      if (f) addFromFood(f)
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Da alimento custom…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {customFoods.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmptyRow}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Manuale
                </Button>
              </div>
            </div>

            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nessun ingrediente. Aggiungi dal menu sopra.
              </p>
            )}

            {items.map((it) => (
              <RecipeItemRow
                key={it._key}
                item={it}
                linked={!!it.food_id}
                onChangeGrams={(g) => updateGramsFromFood(it._key, g)}
                onChange={(patch) => updateItem(it._key, patch)}
                onRemove={() => removeItem(it._key)}
              />
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="grid grid-cols-4 gap-2 rounded-md border border-border bg-background/50 p-3 font-mono text-xs tabular">
            <MiniStat label="Totale kcal" value={round0(totals.kcal)} primary />
            <MiniStat label="P tot" value={`${round0(totals.protein)}g`} />
            <MiniStat label="C tot" value={`${round0(totals.carb)}g`} />
            <MiniStat label="G tot" value={`${round0(totals.fat)}g`} />
          </div>
          <div className="grid grid-cols-4 gap-2 font-mono text-xs tabular text-muted-foreground">
            <MiniStat label="per porz" value={round1(totals.kcal / s)} />
            <MiniStat label="P" value={`${round1(totals.protein / s)}g`} />
            <MiniStat label="C" value={`${round1(totals.carb / s)}g`} />
            <MiniStat label="G" value={`${round1(totals.fat / s)}g`} />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Salvataggio…' : recipe ? 'Salva modifiche' : 'Crea ricetta'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecipeItemRow({
  item,
  linked,
  onChange,
  onChangeGrams,
  onRemove,
}: {
  item: DraftItem
  linked: boolean
  onChange: (patch: Partial<DraftItem>) => void
  onChangeGrams: (g: number) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Input
          placeholder="Nome ingrediente"
          value={item.food_name_snapshot}
          onChange={(e) => onChange({ food_name_snapshot: e.target.value })}
          disabled={linked}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Rimuovi"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <NumField
          label="Grammi"
          value={item.grams}
          onChange={(n) => onChangeGrams(n)}
        />
        <NumField
          label="Kcal"
          value={item.kcal_snapshot}
          onChange={(n) => onChange({ kcal_snapshot: n })}
          disabled={linked}
        />
        <NumField
          label="P (g)"
          value={item.protein_snapshot}
          onChange={(n) => onChange({ protein_snapshot: n })}
          disabled={linked}
        />
        <NumField
          label="C (g)"
          value={item.carb_snapshot}
          onChange={(n) => onChange({ carb_snapshot: n })}
          disabled={linked}
        />
        <NumField
          label="G (g)"
          value={item.fat_snapshot}
          onChange={(n) => onChange({ fat_snapshot: n })}
          disabled={linked}
        />
      </div>
      {linked && (
        <p className="text-[10px] text-muted-foreground">
          Ingrediente collegato: macro aggiornati automaticamente cambiando i grammi.
        </p>
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <Input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        disabled={disabled}
        className="h-8 px-2 font-mono text-xs"
      />
    </div>
  )
}
