import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
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
import {
  SCOPE_HINTS,
  SCOPE_LABELS,
  useAddLearnedCorrection,
  useDeleteLearnedCorrection,
  useLearnedCorrections,
  useUpdateLearnedCorrection,
  type CorrectionScope,
} from '@/features/ai/useLearnedCorrections'

export function CorrectionsSection() {
  const { data: corrections = [], isLoading } = useLearnedCorrections()
  const add = useAddLearnedCorrection()
  const update = useUpdateLearnedCorrection()
  const del = useDeleteLearnedCorrection()

  const [scope, setScope] = useState<CorrectionScope>('rule')
  const [content, setContent] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Scrivi la correzione')
      return
    }
    try {
      await add.mutateAsync({ scope, content, active: true })
      toast.success('Correzione salvata')
      setContent('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await update.mutateAsync({ id, patch: { active: !current } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa correzione?')) return
    try {
      await del.mutateAsync(id)
      toast.success('Correzione eliminata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const activeCount = corrections.filter((c) => c.active).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Correzioni apprese</CardTitle>
        <CardDescription>
          Preferenze e fatti che l'AI deve ricordare trasversalmente. Iniettate
          nel contesto di chat e parsing pasti.{' '}
          {activeCount > 0 && `(${activeCount} attive)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="correction_scope">Ambito</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as CorrectionScope)}
            >
              <SelectTrigger id="correction_scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCOPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{SCOPE_HINTS[scope]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="correction_content">Testo</Label>
            <Textarea
              id="correction_content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrivi come lo diresti a un umano…"
            />
          </div>

          <Button type="submit" disabled={add.isPending}>
            <Plus className="h-4 w-4" />
            {add.isPending ? 'Aggiunta…' : 'Aggiungi correzione'}
          </Button>
        </form>

        {corrections.length > 0 && <Separator />}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna correzione salvata. Aggiungine una quando vuoi che l'AI
            ricordi qualcosa di trasversale.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {corrections.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5',
                  !c.active && 'opacity-50',
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                      {SCOPE_LABELS[c.scope]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(c.created_at), 'd MMM yyyy', { locale: it })}
                    </span>
                  </div>
                  <p className="text-sm leading-snug">{c.content}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(c.id, c.active)}
                  disabled={update.isPending}
                >
                  {c.active ? 'Disattiva' : 'Attiva'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(c.id)}
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
    </Card>
  )
}
