import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { RotateCcw } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Separator } from '@/components/ui/Separator'
import {
  DEFAULT_SYSTEM_PROMPT,
  useActivateSystemPrompt,
  useActiveSystemPrompt,
  useSaveSystemPrompt,
  useSystemPrompts,
} from '@/features/ai/useSystemPrompt'

export function SystemPromptSection() {
  const { data: prompts = [] } = useSystemPrompts()
  const { data: active } = useActiveSystemPrompt()
  const save = useSaveSystemPrompt()
  const activate = useActivateSystemPrompt()

  const [content, setContent] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  // Inizializza il content quando active arriva
  useEffect(() => {
    if (active) {
      setContent(active.content)
    } else if (prompts.length === 0) {
      // Nessun prompt ancora salvato: mostra il default editabile
      setContent(DEFAULT_SYSTEM_PROMPT)
    }
  }, [active, prompts.length])

  const isDirty = content !== (active?.content ?? DEFAULT_SYSTEM_PROMPT)

  async function handleSave() {
    if (!content.trim()) {
      toast.error('Il prompt non può essere vuoto')
      return
    }
    try {
      const nextVersion = await save.mutateAsync(content)
      toast.success(`Salvato come v${nextVersion}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleActivate() {
    if (!selectedVersion) return
    try {
      await activate.mutateAsync(selectedVersion)
      toast.success('Versione attivata')
      setSelectedVersion(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  function handleResetToDefault() {
    if (!confirm('Ripristinare il testo di default? Le tue modifiche non salvate andranno perse.')) {
      return
    }
    setContent(DEFAULT_SYSTEM_PROMPT)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System prompt</CardTitle>
        <CardDescription>
          Le regole che l'AI segue per tutti i suggerimenti. Viene iniettato
          prima di ogni chat/parsing. Salvando crei una nuova versione — le
          vecchie restano consultabili.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {active
              ? `Versione attiva: v${active.version} · ${format(parseISO(active.created_at), 'd MMM yyyy HH:mm', { locale: it })}`
              : 'Nessuna versione salvata (stai modificando il default)'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Default
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="system_prompt" className="sr-only">
            System prompt
          </Label>
          <Textarea
            id="system_prompt"
            rows={18}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{content.length.toLocaleString('it-IT')} caratteri</span>
            <span>~{Math.round(content.length / 4)} token stimati</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={save.isPending || !isDirty}
          >
            {save.isPending ? 'Salvataggio…' : 'Salva nuova versione'}
          </Button>
          {prompts.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? 'Nascondi storico' : `Storico (${prompts.length})`}
            </Button>
          )}
        </div>

        {showHistory && prompts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Storico versioni</h4>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="version_select">Ripristina versione</Label>
                  <Select
                    value={selectedVersion ?? undefined}
                    onValueChange={setSelectedVersion}
                  >
                    <SelectTrigger id="version_select">
                      <SelectValue placeholder="Scegli versione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {prompts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          v{p.version}
                          {p.active && ' · attiva'}
                          {' · '}
                          {format(parseISO(p.created_at), 'd MMM yyyy HH:mm', {
                            locale: it,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleActivate}
                  disabled={!selectedVersion || activate.isPending}
                >
                  Attiva
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
