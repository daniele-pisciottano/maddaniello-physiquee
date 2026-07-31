import { useMemo, useState } from 'react'
import { Search, Plus, AlertTriangle, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useExerciseSearch } from '@/features/workout/useExercises'
import {
  EQUIPMENT_LABELS,
  MUSCLE_ORDER,
  muscleLabel,
  type Exercise,
} from '@/features/workout/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chiamata con gli esercizi scelti alla conferma. */
  onSelect: (exercises: Exercise[]) => void
  /** Se true permette la selezione multipla con conferma finale. */
  multiple?: boolean
  title?: string
}

export function ExercisePickerDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = true,
  title = 'Aggiungi esercizio',
}: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [picked, setPicked] = useState<Exercise[]>([])

  const filters = useMemo(() => ({ muscle, equipment }), [muscle, equipment])
  const { results, isLoading } = useExerciseSearch(query, filters)

  function reset() {
    setQuery('')
    setMuscle(null)
    setEquipment(null)
    setPicked([])
  }

  function handleRowClick(ex: Exercise) {
    if (!multiple) {
      onSelect([ex])
      onOpenChange(false)
      reset()
      return
    }
    setPicked((prev) =>
      prev.some((p) => p.id === ex.id)
        ? prev.filter((p) => p.id !== ex.id)
        : [...prev, ex],
    )
  }

  function confirm() {
    if (picked.length === 0) return
    onSelect(picked)
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Cerca per nome o filtra per gruppo muscolare e attrezzo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="es. panca, squat, trazioni…"
              className="pl-9"
            />
          </div>

          <FilterRow
            label="Muscolo"
            options={MUSCLE_ORDER.map((m) => [m, muscleLabel(m)])}
            value={muscle}
            onChange={setMuscle}
          />
          <FilterRow
            label="Attrezzo"
            options={Object.entries(EQUIPMENT_LABELS)}
            value={equipment}
            onChange={setEquipment}
          />
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-md border border-border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Caricamento…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nessun esercizio trovato. Prova con un altro nome o togli i
              filtri.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.slice(0, 80).map((ex) => {
                const isPicked = picked.some((p) => p.id === ex.id)
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(ex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary',
                        isPicked && 'bg-secondary',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {ex.name}
                          </span>
                          {ex.tier === 1 && (
                            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                              base
                            </span>
                          )}
                          {ex.discouraged && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="Sconsigliato"
                            />
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {muscleLabel(ex.primary_muscle)}
                          {' · '}
                          {EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment}
                          {ex.user_id && ' · personalizzato'}
                        </div>
                      </div>
                      {isPicked && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {multiple && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {picked.length === 0
                ? 'Nessun esercizio selezionato'
                : `${picked.length} selezionat${picked.length === 1 ? 'o' : 'i'}`}
            </span>
            <Button type="button" onClick={confirm} disabled={picked.length === 0}>
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<[string, string]>
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'shrink-0 rounded-full border border-border px-2.5 py-1 text-xs transition-colors',
          value === null
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-secondary',
        )}
      >
        Tutti
      </button>
      {options.map(([key, lbl]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(value === key ? null : key)}
          className={cn(
            'shrink-0 rounded-full border border-border px-2.5 py-1 text-xs transition-colors',
            value === key
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary',
          )}
        >
          {lbl}
        </button>
      ))}
    </div>
  )
}
