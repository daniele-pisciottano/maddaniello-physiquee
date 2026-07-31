import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { cn } from '@/lib/utils'
import {
  useDeleteRoutine,
  useRoutineFolders,
  useRoutines,
} from '@/features/workout/useRoutines'
import { useActiveSession, useStartSession } from '@/features/workout/useSessions'
import type { Routine, RoutineFolder } from '@/features/workout/types'
import { RoutineEditor, WEEKDAY_LABELS } from './RoutineEditor'

export function RoutinesTab() {
  const navigate = useNavigate()
  const {
    data: folders = [],
    isLoading: foldersLoading,
    isError: foldersError,
  } = useRoutineFolders()
  const {
    data: routines = [],
    isLoading: routinesLoading,
    isError: routinesError,
  } = useRoutines()
  const { data: active } = useActiveSession()

  const start = useStartSession()
  const del = useDeleteRoutine()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Routine | null>(null)
  const [openRationale, setOpenRationale] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const byFolder = new Map<string, Routine[]>()
    const loose: Routine[] = []
    for (const r of routines) {
      if (!r.folder_id) {
        loose.push(r)
        continue
      }
      const list = byFolder.get(r.folder_id)
      if (list) list.push(r)
      else byFolder.set(r.folder_id, [r])
    }
    return { byFolder, loose }
  }, [routines])

  async function handleStart(routine: Routine) {
    if (active) {
      toast.error(
        'Hai già un allenamento in corso. Riprendilo o chiudilo prima di iniziarne un altro.',
      )
      return
    }
    try {
      await start.mutateAsync({ routineId: routine.id, name: routine.name })
      navigate('/allenamento/sessione')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Impossibile avviare la scheda',
      )
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    try {
      await del.mutateAsync(toDelete.id)
      toast.success('Scheda eliminata')
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore in eliminazione')
    }
  }

  function openEditor(routineId: string | null) {
    setEditingId(routineId)
    setEditorOpen(true)
  }

  if (foldersError || routinesError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Non è stato possibile caricare le schede. Controlla la connessione e
        riprova.
      </div>
    )
  }

  if (foldersLoading || routinesLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const usedFolders = folders.filter((f) => grouped.byFolder.has(f.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {routines.length === 0
            ? 'Nessuna scheda salvata.'
            : `${routines.length} sched${routines.length === 1 ? 'a' : 'e'} salvate.`}
        </p>
        <Button type="button" onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4" />
          Nuova scheda
        </Button>
      </div>

      {routines.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Non hai ancora schede. Creane una a mano oppure fatti generare un
            programma completo dal Coach AI.
          </p>
        </div>
      )}

      {usedFolders.map((folder) => (
        <FolderSection
          key={folder.id}
          folder={folder}
          routines={grouped.byFolder.get(folder.id) ?? []}
          rationaleOpen={openRationale === folder.id}
          onToggleRationale={() =>
            setOpenRationale(openRationale === folder.id ? null : folder.id)
          }
          onStart={handleStart}
          onEdit={openEditor}
          onDelete={setToDelete}
          starting={start.isPending}
        />
      ))}

      {grouped.loose.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Schede sciolte</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {grouped.loose.map((r) => (
              <RoutineCard
                key={r.id}
                routine={r}
                onStart={handleStart}
                onEdit={openEditor}
                onDelete={setToDelete}
                starting={start.isPending}
              />
            ))}
          </div>
        </section>
      )}

      <RoutineEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        routineId={editingId}
      />

      <Dialog
        open={!!toDelete}
        onOpenChange={(o) => {
          if (!o) setToDelete(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare la scheda?</DialogTitle>
            <DialogDescription>
              «{toDelete?.name}» non comparirà più tra le schede. Le sedute già
              registrate con questa scheda restano nello storico.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setToDelete(null)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              {del.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Elimina
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FolderSection({
  folder,
  routines,
  rationaleOpen,
  onToggleRationale,
  onStart,
  onEdit,
  onDelete,
  starting,
}: {
  folder: RoutineFolder
  routines: Routine[]
  rationaleOpen: boolean
  onToggleRationale: () => void
  onStart: (r: Routine) => void
  onEdit: (id: string) => void
  onDelete: (r: Routine) => void
  starting: boolean
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{folder.name}</h3>
        {folder.source === 'ai' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        )}
        {folder.goal && (
          <span className="text-xs text-muted-foreground">{folder.goal}</span>
        )}
        {folder.days_per_week != null && (
          <span className="text-xs text-muted-foreground">
            · {folder.days_per_week} giorni a settimana
          </span>
        )}
      </div>

      {folder.ai_rationale && (
        <div className="rounded-md border border-border bg-card/50">
          <button
            type="button"
            onClick={onToggleRationale}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            {rationaleOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            Perché questo programma
          </button>
          {rationaleOpen && (
            <p className="border-t border-border px-3 py-3 text-sm leading-relaxed text-muted-foreground">
              {folder.ai_rationale}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {routines.map((r) => (
          <RoutineCard
            key={r.id}
            routine={r}
            onStart={onStart}
            onEdit={onEdit}
            onDelete={onDelete}
            starting={starting}
          />
        ))}
      </div>
    </section>
  )
}

function RoutineCard({
  routine,
  onStart,
  onEdit,
  onDelete,
  starting,
}: {
  routine: Routine
  onStart: (r: Routine) => void
  onEdit: (id: string) => void
  onDelete: (r: Routine) => void
  starting: boolean
}) {
  const weekday =
    routine.weekday != null ? WEEKDAY_LABELS[routine.weekday] : null

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">{routine.name}</h4>
          {weekday && (
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
              {weekday}
            </span>
          )}
          {routine.source === 'ai' && (
            <Sparkles className="h-3 w-3 text-primary" aria-label="Generata dall'AI" />
          )}
        </div>
        {routine.description && (
          <p className="mt-1 text-xs text-muted-foreground">
            {routine.description}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {routine.last_performed_at
            ? `Ultima volta il ${format(parseISO(routine.last_performed_at), 'd MMM yyyy', { locale: it })}`
            : 'Mai eseguita'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onStart(routine)}
          disabled={starting}
        >
          <Play className="h-3.5 w-3.5" />
          Inizia
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onEdit(routine.id)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Modifica
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onDelete(routine)}
          className={cn('ml-auto text-muted-foreground hover:text-destructive')}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Elimina
        </Button>
      </div>
    </div>
  )
}
