import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { useResetAccount } from '@/features/account/useReset'

const CONFIRM_PHRASE = 'RICOMINCIA'

export function DangerZoneSection() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const reset = useResetAccount()
  const navigate = useNavigate()

  async function handleReset() {
    if (confirm !== CONFIRM_PHRASE) {
      toast.error(`Scrivi esattamente "${CONFIRM_PHRASE}" per confermare`)
      return
    }
    try {
      const res = await reset.mutateAsync()
      toast.success(`Dati cancellati (${res.tables_cleared} tabelle ripulite)`)
      setOpen(false)
      setConfirm('')
      navigate('/assessment')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore durante il reset')
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Zona pericolosa
        </CardTitle>
        <CardDescription>
          Azioni irreversibili. L'account auth resta (non devi ri-registrarti),
          ma tutti i dati vengono cancellati.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Cosa viene cancellato</p>
          <p className="mt-1">
            misure, pasti, alimenti custom, ricette, regole, allenamenti, sonno,
            integratori, chat, correzioni, review, API key AI, system prompt.
            Il profilo viene resettato ai valori iniziali.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
        >
          <AlertTriangle className="h-4 w-4" />
          Ricomincia da capo
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Conferma reset completo
            </DialogTitle>
            <DialogDescription>
              Questa azione è <b>irreversibile</b>. Verranno cancellati tutti i
              dati associati al tuo account. Dopo il reset parte l'assessment
              wizard per ricominciare.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm_reset">
              Scrivi{' '}
              <span className="font-mono text-destructive">
                {CONFIRM_PHRASE}
              </span>{' '}
              per confermare
            </Label>
            <Input
              id="confirm_reset"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="font-mono"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleReset}
              disabled={reset.isPending || confirm !== CONFIRM_PHRASE}
            >
              {reset.isPending ? 'Cancellazione…' : 'Procedi al reset'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                setConfirm('')
              }}
            >
              Annulla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
