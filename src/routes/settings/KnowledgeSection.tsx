import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { BookOpen, Loader2, Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
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
  useAddKnowledgeDoc,
  useDeleteKnowledgeDoc,
  useKnowledgeDocs,
} from '@/features/knowledge/useKnowledge'

export function KnowledgeSection() {
  const { data: docs = [] } = useKnowledgeDocs()
  const del = useDeleteKnowledgeDoc()
  const [open, setOpen] = useState(false)

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo documento? I chunk vengono rimossi dalla retrieval.'))
      return
    try {
      await del.mutateAsync(id)
      toast.success('Documento eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge base</CardTitle>
        <CardDescription>
          Carica studi, articoli o appunti in markdown. L'AI li userà come
          riferimento nelle chat quando pertinenti (retrieval via embedding +
          pgvector).
          <br />
          <span className="text-[10px] uppercase tracking-widest text-warning">
            Richiede API key OpenAI (embedding text-embedding-3-small)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Carica documento
        </Button>

        {docs.length > 0 && <Separator />}

        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun documento. Carica la prima guida/articolo/appunto che vuoi
            che l'AI conosca.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="font-mono text-[10px] tabular text-muted-foreground">
                    {d.char_count.toLocaleString('it-IT')} caratteri ·{' '}
                    {format(parseISO(d.created_at), 'd MMM yyyy', { locale: it })}
                    {d.source_url && ' · '}
                    {d.source_url && (
                      <a
                        href={d.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        fonte
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(d.id)}
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

      <AddKnowledgeDialog open={open} onOpenChange={setOpen} />
    </Card>
  )
}

function AddKnowledgeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [content, setContent] = useState('')
  const add = useAddKnowledgeDoc()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error('Titolo richiesto')
    if (!content.trim()) return toast.error('Contenuto richiesto')
    try {
      const res = await add.mutateAsync({
        title: title.trim(),
        content_md: content,
        source_url: sourceUrl.trim() || null,
      })
      toast.success(
        `Caricato: ${res.chunks} chunk (${res.cost_cents < 1 ? '<1¢' : (res.cost_cents / 100).toFixed(2) + '¢'})`,
      )
      setTitle('')
      setSourceUrl('')
      setContent('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Carica documento</DialogTitle>
          <DialogDescription>
            Incolla il testo (markdown supportato). Verrà chunkato ed embeddato
            in un'unica call. Costo tipico: ~$0.0002 per 10k caratteri.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="k_title">Titolo</Label>
            <Input
              id="k_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Guida al bulk pulito di Jeff Nippard"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="k_url">URL fonte (opz.)</Label>
            <Input
              id="k_url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="k_content">
              Contenuto ({content.length.toLocaleString('it-IT')} caratteri)
            </Label>
            <Textarea
              id="k_content"
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Incolla qui il testo dell'articolo/guida/appunti..."
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground">
              Max ~80.000 caratteri. Il documento viene splittato in chunk da
              ~1000 caratteri e indicizzato via embedding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Indicizzazione…
                </>
              ) : (
                'Carica e indicizza'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
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
