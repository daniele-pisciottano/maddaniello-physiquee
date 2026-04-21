import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Scale, Loader2 } from 'lucide-react'
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
import { useAddMeasurement } from '@/features/measurements/useMeasurements'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function QuickWeighDialog({ open, onOpenChange, onSaved }: Props) {
  const add = useAddMeasurement()
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState('')
  const [bfScale, setBfScale] = useState('')
  const [bfVisual, setBfVisual] = useState('')

  useEffect(() => {
    if (open) {
      setDate(today())
      setWeight('')
      setBfScale('')
      setBfVisual('')
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const w = Number(weight)
    if (!Number.isFinite(w) || w < 20 || w > 400) {
      toast.error('Peso tra 20 e 400 kg')
      return
    }
    const scale = bfScale ? Number(bfScale) : null
    const visual = bfVisual ? Number(bfVisual) : null
    if (scale != null && (scale < 3 || scale > 60)) {
      toast.error('Body fat bilancia tra 3 e 60%')
      return
    }
    if (visual != null && (visual < 3 || visual > 60)) {
      toast.error('Body fat visuale tra 3 e 60%')
      return
    }
    try {
      await add.mutateAsync({
        measured_at: date,
        weight_kg: w,
        body_fat_scale_pct: scale,
        body_fat_visual_pct: visual,
      })
      toast.success('Peso registrato')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Pesati ora
          </DialogTitle>
          <DialogDescription>
            Entry rapida per pesa + body fat. Per misure dettagliate
            (circonferenze, note) usa Impostazioni → Misure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qw_date">Data</Label>
              <Input
                id="qw_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qw_weight">Peso (kg)</Label>
              <Input
                id="qw_weight"
                type="number"
                step="0.1"
                min="20"
                max="400"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="75.3"
                className="font-mono"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qw_bf_scale">BF bilancia (%)</Label>
              <Input
                id="qw_bf_scale"
                type="number"
                step="0.1"
                min="3"
                max="60"
                value={bfScale}
                onChange={(e) => setBfScale(e.target.value)}
                placeholder="es. 16.5"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Dato della bilancia bioimpedenziometrica
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qw_bf_visual">BF visuale (%)</Label>
              <Input
                id="qw_bf_visual"
                type="number"
                step="0.1"
                min="3"
                max="60"
                value={bfVisual}
                onChange={(e) => setBfVisual(e.target.value)}
                placeholder="es. 14"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Stima da specchio / foto / confronto chart
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={add.isPending || !weight}>
              {add.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio…
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4" />
                  Registra
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
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
