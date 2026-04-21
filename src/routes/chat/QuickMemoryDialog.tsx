import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { BookMarked, Scale } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import {
  ruleRequiresValue,
  RULE_TYPE_LABELS,
  useAddDietaryRule,
  type DietaryRuleType,
} from '@/features/rules/useDietaryRules'
import {
  SCOPE_HINTS,
  SCOPE_LABELS,
  useAddLearnedCorrection,
  type CorrectionScope,
} from '@/features/ai/useLearnedCorrections'

type Tab = 'rule' | 'correction'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultTab?: Tab
}

export function QuickMemoryDialog({
  open,
  onOpenChange,
  defaultTab = 'correction',
}: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aggiungi alla memoria AI</DialogTitle>
          <DialogDescription>
            Regole alimentari e correzioni apprese vengono iniettate nel
            contesto di ogni chat e parsing pasti.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1">
          <TabBtn
            label="Correzione"
            icon={BookMarked}
            active={tab === 'correction'}
            onClick={() => setTab('correction')}
          />
          <TabBtn
            label="Regola alimentare"
            icon={Scale}
            active={tab === 'rule'}
            onClick={() => setTab('rule')}
          />
        </div>

        <div className="min-h-[180px]">
          {tab === 'correction' && (
            <CorrectionForm onDone={() => onOpenChange(false)} />
          )}
          {tab === 'rule' && <RuleForm onDone={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabBtn({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof BookMarked
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-sm py-2 text-xs transition-colors',
        active
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// ============================================================
// CORRECTION FORM
// ============================================================
function CorrectionForm({ onDone }: { onDone: () => void }) {
  const [scope, setScope] = useState<CorrectionScope>('rule')
  const [content, setContent] = useState('')
  const add = useAddLearnedCorrection()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Scrivi la correzione')
      return
    }
    try {
      await add.mutateAsync({ scope, content, active: true })
      toast.success('Correzione salvata')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="qm_scope">Ambito</Label>
        <Select
          value={scope}
          onValueChange={(v) => setScope(v as CorrectionScope)}
        >
          <SelectTrigger id="qm_scope">
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
        <Label htmlFor="qm_content">Cosa deve ricordare l'AI</Label>
        <Textarea
          id="qm_content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="es. Non suggerire mai pollo 3 giorni di fila"
          autoFocus
        />
      </div>

      <Button type="submit" disabled={add.isPending} className="w-full">
        {add.isPending ? 'Salvataggio…' : 'Salva correzione'}
      </Button>
    </form>
  )
}

// ============================================================
// RULE FORM
// ============================================================
function RuleForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<DietaryRuleType>('max_per_week')
  const [target, setTarget] = useState('')
  const [value, setValue] = useState('3')
  const [notes, setNotes] = useState('')
  const add = useAddDietaryRule()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!target.trim()) {
      toast.error('Specifica un alimento o categoria')
      return
    }
    const rule_value: Record<string, unknown> = { target: target.trim() }
    if (ruleRequiresValue(type)) {
      const n = Number(value)
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('Inserisci un valore > 0')
        return
      }
      rule_value.value = n
    }
    try {
      await add.mutateAsync({
        rule_type: type,
        rule_value,
        notes: notes.trim() || null,
        active: true,
      })
      toast.success('Regola aggiunta')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="qr_type">Tipo</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as DietaryRuleType)}
          >
            <SelectTrigger id="qr_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RULE_TYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qr_target">Alimento / categoria</Label>
          <Input
            id="qr_target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="es. carne"
            autoFocus
          />
        </div>
      </div>

      {ruleRequiresValue(type) && (
        <div className="space-y-2">
          <Label htmlFor="qr_value">Quante volte</Label>
          <Input
            id="qr_value"
            type="number"
            min="1"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="font-mono max-w-[120px]"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="qr_notes">Note (opz.)</Label>
        <Textarea
          id="qr_notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={add.isPending} className="w-full">
        {add.isPending ? 'Salvataggio…' : 'Aggiungi regola'}
      </Button>
    </form>
  )
}
