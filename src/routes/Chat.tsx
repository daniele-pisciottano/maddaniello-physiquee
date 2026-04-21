import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Send,
  Sparkles,
  Trash2,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  useChatMessages,
  useClearChat,
  useSendChatMessage,
  type ChatMessageRow,
} from '@/features/ai/useChat'

const SUGGESTIONS = [
  'Cosa posso mangiare a cena stasera?',
  'Analizza la mia giornata nutrizionale',
  'Dammi 3 idee di spuntino sotto le 200 kcal',
  'Come sto andando con i target questa settimana?',
  'Suggerimi una colazione ad alto contenuto proteico',
  'Cosa mi manca per arrivare al target di oggi?',
]

export function Chat() {
  const { data: messages = [], isLoading } = useChatMessages()
  const send = useSendChatMessage()
  const clear = useClearChat()
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const lastMsg = messages[messages.length - 1]
  const lastUpdatedAt = useMemo(() => lastMsg?.created_at, [lastMsg?.created_at])

  // Auto-scroll bottom on new message
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, send.isPending, lastUpdatedAt])

  async function handleSend(text?: string) {
    const content = (text ?? input).trim()
    if (!content || send.isPending) return
    setInput('')
    try {
      await send.mutateAsync(content)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleClear() {
    if (!confirm('Cancellare tutta la conversazione? Non è reversibile.')) return
    try {
      await clear.mutateAsync()
      toast.success('Conversazione cancellata')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col md:h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Companion
          </p>
          <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            Chat AI
          </h2>
        </div>
        {messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={clear.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Pulisci
          </Button>
        )}
      </div>

      {/* Messages list */}
      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-card/50 p-4"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onPromptClick={(p) => handleSend(p)} />
        ) : (
          messages.map((m) => <ChatBubble key={m.id} message={m} />)
        )}
        {send.isPending && <ThinkingBubble />}
      </div>

      {/* Input */}
      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chiedi qualcosa… (Shift+Enter per nuova riga)"
          rows={2}
          disabled={send.isPending}
          className="resize-none"
        />
        <Button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || send.isPending}
          size="icon"
          className="h-[60px] w-12 shrink-0"
          aria-label="Invia"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        L'AI vede profilo, target, pasti di oggi e settimana, regole alimentari,
        correzioni apprese. Risponde in base al tuo system prompt attivo.
      </p>
    </div>
  )
}

// ============================================================
// Empty state con prompt suggeriti
// ============================================================
function EmptyState({
  onPromptClick,
}: {
  onPromptClick: (prompt: string) => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-base font-semibold">Parla col tuo companion</h3>
        <p className="text-sm text-muted-foreground">
          Chiedi cosa mangiare, analisi della giornata, idee per i pasti.
          L'AI conosce i tuoi obiettivi, i pasti di oggi e le regole attive.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPromptClick(s)}
            className="rounded-md border border-border bg-background p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Bubble
// ============================================================
function ChatBubble({ message }: { message: ChatMessageRow }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[85%] space-y-1 rounded-lg px-3 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div className="prose-chat text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <div
          className={cn(
            'flex items-center gap-2 text-[10px]',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground',
          )}
        >
          <span>
            {format(parseISO(message.created_at), 'HH:mm', { locale: it })}
          </span>
          {!isUser && message.model && (
            <>
              <span>·</span>
              <span className="font-mono">{message.model}</span>
              {message.cost_usd_cents != null && message.cost_usd_cents > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular">
                    {message.cost_usd_cents < 1
                      ? '<1¢'
                      : `${(message.cost_usd_cents / 100).toFixed(2)}¢`}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5 animate-pulse text-primary" />
        <span className="font-mono text-xs">sto pensando…</span>
      </div>
    </div>
  )
}
