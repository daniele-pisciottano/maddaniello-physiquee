// Food picker condiviso: 3 tab (Cerca, Barcode, Rapido) più FoodGramsPicker
// e MacroPreview. Usati da MealAddDialog e IngredientPickerDialog.

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { kcalFromMacros, round1, scaleForGrams } from '@/lib/macro'
import { offProductByBarcode, offSearch, type OffFood } from '@/lib/off'
import { useAddFood, useFoods, type Food } from '@/features/foods/useFoods'
import { BarcodeScanner } from '@/components/BarcodeScanner'

export type PickedFood = {
  food_id: string | null
  food_name: string
  grams: number
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  source: 'manual' | 'barcode'
}

export type OnPickFood = (p: PickedFood) => void | Promise<void>

type SelectedFood =
  | { kind: 'local'; food: Food }
  | { kind: 'off'; food: OffFood }

// ============================================================
// SEARCH TAB
// ============================================================
export function FoodSearchTab({ onPicked }: { onPicked: OnPickFood }) {
  const [query, setQuery] = useState('')
  const { data: localFoods = [] } = useFoods(
    query.length >= 1 ? query : undefined,
  )
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
        onConfirm={async (grams) => {
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
          await onPicked({
            food_id: selected.kind === 'local' ? selected.food.id : null,
            food_name:
              selected.kind === 'local'
                ? selected.food.name
                : `${selected.food.name}${selected.food.brand ? ` · ${selected.food.brand}` : ''}`,
            grams,
            kcal: scaled.kcal,
            protein_g: scaled.protein,
            carb_g: scaled.carb,
            fat_g: scaled.fat,
            source: selected.kind === 'local' ? 'manual' : 'barcode',
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

      {query.length >= 2 && localFoods.length === 0 && offResults === null && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nessun alimento locale. Usa "Cerca su OFF" o il tab Rapido.
        </p>
      )}
    </div>
  )
}

// ============================================================
// BARCODE TAB
// ============================================================
type BcStatus = 'scanning' | 'looking' | 'not_found' | 'error'

export function FoodBarcodeTab({ onPicked }: { onPicked: OnPickFood }) {
  const [food, setFood] = useState<OffFood | null>(null)
  const [status, setStatus] = useState<BcStatus>('scanning')
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleDetected(code: string) {
    setLastCode(code)
    setStatus('looking')
    try {
      const res = await offProductByBarcode(code)
      if (!res) {
        setStatus('not_found')
      } else {
        setFood(res)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore OFF'
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  function retry() {
    setFood(null)
    setLastCode(null)
    setErrorMsg(null)
    setStatus('scanning')
  }

  if (food) {
    return (
      <FoodGramsPicker
        selected={{ kind: 'off', food }}
        onBack={retry}
        onConfirm={async (grams) => {
          const scaled = scaleForGrams(
            {
              kcal: food.kcal_100g,
              protein: food.protein_100g,
              carb: food.carb_100g,
              fat: food.fat_100g,
            },
            grams,
          )
          await onPicked({
            food_id: null,
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
    <div className="space-y-3">
      {status === 'scanning' && <BarcodeScanner onDetected={handleDetected} />}
      {status === 'looking' && (
        <div className="rounded-md border border-border bg-background/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ricerca su Open Food Facts…
          </p>
          {lastCode && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {lastCode}
            </p>
          )}
        </div>
      )}
      {status === 'not_found' && (
        <div className="space-y-3 rounded-md border border-warning/40 bg-warning/10 p-4">
          <div>
            <p className="text-sm font-semibold text-warning">
              Prodotto non trovato
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Il barcode <span className="font-mono">{lastCode}</span> non è su
              Open Food Facts (o senza dati nutrizionali).
            </p>
          </div>
          <Button type="button" size="sm" onClick={retry}>
            Scansiona di nuovo
          </Button>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <div>
            <p className="text-sm font-semibold text-destructive">Errore</p>
            <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
          </div>
          <Button type="button" size="sm" onClick={retry}>
            Riprova
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// MANUAL TAB
// ============================================================
export function FoodManualTab({
  onPicked,
  allowSaveAsFood = true,
}: {
  onPicked: OnPickFood
  allowSaveAsFood?: boolean
}) {
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('100')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carb, setCarb] = useState('')
  const [fat, setFat] = useState('')
  const [saveAsFood, setSaveAsFood] = useState(false)
  const addFood = useAddFood()

  const p = num(protein)
  const c = num(carb)
  const f = num(fat)
  const g = num(grams)
  const computedKcal = kcalFromMacros(p, c, f)
  const kcalShown = num(kcal) > 0 ? num(kcal) : round1(computedKcal)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Nome richiesto')
    if (g <= 0) return toast.error('Grammi > 0')
    if (kcalShown <= 0) return toast.error('Inserisci kcal o macro')

    let savedFoodId: string | null = null
    if (allowSaveAsFood && saveAsFood && g > 0) {
      const factor = 100 / g
      try {
        const saved = await addFood.mutateAsync({
          name: name.trim(),
          source: 'custom',
          kcal_100g: round1(kcalShown * factor),
          protein_100g: round1(p * factor),
          carb_100g: round1(c * factor),
          fat_100g: round1(f * factor),
        })
        savedFoodId = saved.id
        toast.success('Salvato fra gli alimenti custom')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Errore salvataggio custom',
        )
        return
      }
    }

    await onPicked({
      food_id: savedFoodId,
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
        <FieldMini
          id="m_k"
          label="Kcal"
          value={kcal}
          onChange={setKcal}
          placeholder={round1(computedKcal).toString()}
        />
        <FieldMini id="m_p" label="Prot (g)" value={protein} onChange={setProtein} />
        <FieldMini id="m_c" label="Carb (g)" value={carb} onChange={setCarb} />
        <FieldMini id="m_f" label="Grassi (g)" value={fat} onChange={setFat} />
      </div>

      {kcal === '' && computedKcal > 0 && (
        <p className="text-xs text-muted-foreground">
          Kcal calcolate dai macro:{' '}
          <span className="font-mono">{round1(computedKcal)}</span> (P·4 + C·4 + G·9).
          Scrivi un valore diverso per usarlo.
        </p>
      )}

      {allowSaveAsFood && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={saveAsFood}
            onChange={(e) => setSaveAsFood(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-background accent-primary"
          />
          Salva come alimento custom riutilizzabile
        </label>
      )}

      <Button type="submit" className="w-full">
        Conferma
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
// FOOD GRAMS PICKER (shared)
// ============================================================
export function FoodGramsPicker({
  selected,
  onBack,
  onConfirm,
}: {
  selected: SelectedFood
  onBack: () => void
  onConfirm: (grams: number) => Promise<void> | void
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

  const name = selected.food.name
  const brand = selected.food.brand

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
        Conferma
      </Button>
    </div>
  )
}

// ============================================================
// MACRO PREVIEW
// ============================================================
export function MacroPreview({
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

// ============================================================
// Utils
// ============================================================
function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
