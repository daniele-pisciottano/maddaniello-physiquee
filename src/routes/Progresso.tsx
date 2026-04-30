import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Camera,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  getSignedPhotoUrl,
  uploadProgressPhoto,
  deleteProgressPhoto,
  type PhotoOrientation,
} from '@/lib/imageUpload'
import {
  useAnalyzeSession,
  useCreateProgressSession,
  useDeleteProgressSession,
  useProgressSessions,
  useUpdateSessionNotes,
  useUpdateSessionPhotoPath,
  type ProgressSession,
} from '@/features/progress/useProgress'

export function Progresso() {
  const { data: sessions = [], isLoading } = useProgressSessions()
  const create = useCreateProgressSession()
  const del = useDeleteProgressSession()
  const [activeId, setActiveId] = useState<string | null>(null)

  async function handleNewSession() {
    try {
      const s = await create.mutateAsync({})
      toast.success('Nuova sessione creata')
      setActiveId(s.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(session: ProgressSession) {
    if (!confirm('Eliminare sessione e foto? Irreversibile.')) return
    try {
      await del.mutateAsync(session)
      toast.success('Sessione eliminata')
      if (activeId === session.id) setActiveId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0] ?? null

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Progresso
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            Foto e analisi visuale
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Carica foto fronte/retro/lato e lascia che l'AI Vision stimi body
            fat e dia feedback. Le foto restano private (bucket Supabase
            cifrato, RLS per utente).
          </p>
        </div>
        <Button type="button" onClick={handleNewSession} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Nuova sessione
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nessuna sessione ancora. Click "Nuova sessione", carica 1-3 foto
            (fronte, retro, lato), poi tap "Analizza con AI".
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Consigliato: luce naturale uniforme, posa rilassata/standard,
            stesso contesto tra sessioni per confronti coerenti.
          </p>
        </div>
      ) : (
        <>
          {active && (
            <SessionDetail
              session={active}
              onDelete={() => handleDelete(active)}
            />
          )}
          {sessions.length > 1 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold">Storico sessioni</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(s.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          s.id === active?.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background hover:border-primary/40',
                        )}
                      >
                        <div>
                          <div className="font-medium">
                            {format(parseISO(s.taken_at), 'd MMM yyyy', {
                              locale: it,
                            })}
                          </div>
                          <div className="font-mono text-[10px] tabular text-muted-foreground">
                            {[s.front_path, s.back_path, s.side_path].filter(
                              Boolean,
                            ).length}{' '}
                            foto
                            {s.ai_bf_estimate != null &&
                              ` · BF stimato ${s.ai_bf_estimate}%`}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// Session detail: upload slot × 3 + notes + analyze + results
// ============================================================
function SessionDetail({
  session,
  onDelete,
}: {
  session: ProgressSession
  onDelete: () => void
}) {
  const [notes, setNotes] = useState(session.notes ?? '')
  const updateNotes = useUpdateSessionNotes()
  const analyze = useAnalyzeSession()

  useEffect(() => {
    setNotes(session.notes ?? '')
  }, [session.id, session.notes])

  const photoCount = [
    session.front_path,
    session.back_path,
    session.side_path,
  ].filter(Boolean).length

  async function handleSaveNotes() {
    if (notes === (session.notes ?? '')) return
    try {
      await updateNotes.mutateAsync({ id: session.id, notes: notes || null })
      toast.success('Note aggiornate')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleAnalyze() {
    if (photoCount === 0) {
      toast.error('Carica almeno una foto prima di analizzare')
      return
    }
    try {
      const res = await analyze.mutateAsync(session.id)
      toast.success(
        `Analisi completata · BF ${res.session.ai_bf_estimate}% (${res.cost_cents < 1 ? '<1¢' : `${(res.cost_cents / 100).toFixed(2)}¢`})`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore analisi')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              Sessione {format(parseISO(session.taken_at), 'd MMMM yyyy', { locale: it })}
            </CardTitle>
            <CardDescription>
              {photoCount} foto caricate
              {session.ai_analyzed_at &&
                ` · ultima analisi ${format(parseISO(session.ai_analyzed_at), "d MMM HH:mm", { locale: it })}`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label="Elimina sessione"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Elimina
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <PhotoSlot
            sessionId={session.id}
            orientation="front"
            label="Fronte"
            path={session.front_path}
          />
          <PhotoSlot
            sessionId={session.id}
            orientation="back"
            label="Retro"
            path={session.back_path}
          />
          <PhotoSlot
            sessionId={session.id}
            orientation="side"
            label="Lato"
            path={session.side_path}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prog_notes">Note (opz.)</Label>
          <Textarea
            id="prog_notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="es. dopo allenamento, mattina a digiuno, condizioni luce…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={analyze.isPending || photoCount === 0}
          >
            {analyze.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisi in corso…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {session.ai_analyzed_at ? 'Ri-analizza' : 'Analizza con AI'}
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Usa il provider vision attivo (OpenAI gpt-4o / Gemini 2.5).
            ~0.5-2¢ per analisi.
          </p>
        </div>

        {session.ai_analysis && (
          <>
            <Separator />
            <AnalysisView session={session} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Photo slot
// ============================================================
function PhotoSlot({
  sessionId,
  orientation,
  label,
  path,
}: {
  sessionId: string
  orientation: PhotoOrientation
  label: string
  path: string | null
}) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const updatePath = useUpdateSessionPhotoPath()

  useEffect(() => {
    let cancelled = false
    if (path) {
      getSignedPhotoUrl(path).then((url) => {
        if (!cancelled) setSignedUrl(url)
      })
    } else {
      setSignedUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [path])

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const { path: newPath } = await uploadProgressPhoto(
        user.id,
        sessionId,
        orientation,
        file,
      )
      await updatePath.mutateAsync({
        id: sessionId,
        orientation,
        path: newPath,
      })
      toast.success(`${label} caricata`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload fallito')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!path) return
    if (!confirm(`Rimuovere foto ${label.toLowerCase()}?`)) return
    try {
      await deleteProgressPhoto(path)
      await updatePath.mutateAsync({
        id: sessionId,
        orientation,
        path: null,
      })
      toast.success('Foto rimossa')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <div
        className={cn(
          'relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background/50',
          !path && 'hover:border-primary/40',
        )}
      >
        {signedUrl ? (
          <>
            <img
              src={signedUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 bg-black/60 backdrop-blur hover:bg-black/80"
              onClick={handleRemove}
              aria-label="Rimuovi"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Camera className="h-6 w-6" />
            <span className="text-xs">Carica / scatta</span>
          </button>
        )}
      </div>
      {/* Senza capture: il browser/SO mostra il picker nativo con
          opzioni "Libreria foto", "Scatta foto", "Sfoglia file" su mobile.
          Forzare capture impediva di scegliere foto già scattate. */}
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

// ============================================================
// Analysis display
// ============================================================
function AnalysisView({ session }: { session: ProgressSession }) {
  const conf = session.ai_bf_confidence
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            BF stimato AI
          </div>
          <div className="font-mono text-2xl font-semibold tabular text-primary">
            {session.ai_bf_estimate}%
          </div>
          {conf && (
            <div
              className={cn(
                'mt-1 text-[10px] uppercase tracking-widest',
                conf === 'high'
                  ? 'text-primary'
                  : conf === 'medium'
                    ? 'text-muted-foreground'
                    : 'text-warning',
              )}
            >
              confidence: {conf}
            </div>
          )}
        </div>
        {session.ai_lean_mass_kg != null && (
          <div className="rounded-lg border border-border bg-background/50 px-4 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Massa magra stimata
            </div>
            <div className="font-mono text-2xl font-semibold tabular">
              {session.ai_lean_mass_kg} kg
            </div>
          </div>
        )}
      </div>

      <div className="prose-chat text-sm leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {session.ai_analysis ?? ''}
        </ReactMarkdown>
      </div>

      {session.ai_model && (
        <p className="font-mono text-[10px] tabular text-muted-foreground">
          {session.ai_model}
          {session.ai_cost_usd_cents != null &&
            session.ai_cost_usd_cents > 0 &&
            ` · ${session.ai_cost_usd_cents < 1 ? '<1¢' : `${(session.ai_cost_usd_cents / 100).toFixed(2)}¢`}`}
        </p>
      )}
    </div>
  )
}
