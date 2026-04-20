import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
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
import { useAiCredentials, type Provider } from '@/features/ai/useAiCredentials'
import {
  useAiSettings,
  useUpdateAiSettings,
} from '@/features/ai/useAiSettings'
import { AiProviderCard } from './AiProviderCard'

export function AiSection() {
  const { data: credentials = [] } = useAiCredentials()
  const { data: settings } = useAiSettings()
  const update = useUpdateAiSettings()

  const [budget, setBudget] = useState<string>('')
  useEffect(() => {
    if (settings?.monthly_budget_usd != null) {
      setBudget(String(settings.monthly_budget_usd))
    }
  }, [settings?.monthly_budget_usd])

  const configuredProviders = credentials.map((c) => c.provider)
  const canSelectActive = configuredProviders.length > 0

  async function handleActiveChange(value: string) {
    const v = value as Provider
    try {
      await update.mutateAsync({ active_provider: v })
      toast.success(`Provider attivo: ${v}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleBudgetSave() {
    const n = Number(budget)
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Budget non valido')
      return
    }
    try {
      await update.mutateAsync({ monthly_budget_usd: n })
      toast.success('Budget aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  const openaiCred = credentials.find((c) => c.provider === 'openai')
  const geminiCred = credentials.find((c) => c.provider === 'gemini')

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI & modelli</CardTitle>
        <CardDescription>
          Configura le API key (cifrate a riposo con AES-256-GCM lato server).
          Scegli il provider attivo e il tetto di spesa mensile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Settings globali */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="active_provider">Provider attivo</Label>
            <Select
              value={settings?.active_provider ?? undefined}
              onValueChange={handleActiveChange}
              disabled={!canSelectActive || update.isPending}
            >
              <SelectTrigger id="active_provider">
                <SelectValue
                  placeholder={
                    canSelectActive
                      ? 'Seleziona…'
                      : 'Configura almeno un provider'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {configuredProviders.includes('openai') && (
                  <SelectItem value="openai">OpenAI</SelectItem>
                )}
                {configuredProviders.includes('gemini') && (
                  <SelectItem value="gemini">Gemini</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget mensile (USD)</Label>
            <div className="flex gap-2">
              <Input
                id="budget"
                type="number"
                step="0.5"
                min={0}
                max={1000}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBudgetSave}
                disabled={update.isPending}
              >
                Salva
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Le chiamate AI si fermano automaticamente al raggiungimento.
            </p>
          </div>
        </div>

        <Separator />

        {/* Provider cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          <AiProviderCard provider="openai" credential={openaiCred} />
          <AiProviderCard provider="gemini" credential={geminiCred} />
        </div>

        <p className="text-xs text-muted-foreground">
          La tua API key viene cifrata con AES-256-GCM e salvata come blob
          base64. La chiave master risiede solo nelle env Netlify
          (<span className="font-mono">MASTER_ENCRYPTION_KEY</span>), mai nel
          browser. Client e DB non possono decifrarla senza di essa.
        </p>
      </CardContent>
    </Card>
  )
}
