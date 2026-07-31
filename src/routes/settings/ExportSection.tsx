import { useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const TABLES = [
  'profile',
  'measurements',
  'foods',
  'recipes',
  'recipe_items',
  'meal_entries',
  'dietary_rules',
  'workouts',
  'sleep_entries',
  'supplements',
  'supplement_log',
  'routine_folders',
  'routines',
  'workout_sessions',
  'personal_records',
  'phase_reviews',
  'chat_messages',
  'learned_corrections',
  'system_prompts',
  'ai_usage_daily',
  'ai_settings',
] as const

export function ExportSection() {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (!user) return
    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email },
      }

      // Le tabelle sono indipendenti: in sequenza sarebbero venti
      // round-trip uno dopo l'altro.
      const results = await Promise.all(
        TABLES.map(async (table) => {
          // recipe_items è filtrato via join: prendi quelli delle mie ricette
          if (table === 'recipe_items') {
            const { data, error } = await supabase
              .from('recipe_items')
              .select('*, recipes!inner(user_id)')
              .eq('recipes.user_id', user.id)
            if (error) throw new Error(`${table}: ${error.message}`)
            const rows = (data ?? []).map((r: Record<string, unknown>) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { recipes: _r, ...rest } = r
              return rest
            })
            return [table, rows] as const
          }
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)
          if (error) throw new Error(`${table}: ${error.message}`)
          return [table, data ?? []] as const
        }),
      )
      for (const [table, rows] of results) payload[table] = rows

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `physique-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export scaricato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore durante export')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esporta dati</CardTitle>
        <CardDescription>
          Scarica un JSON completo di tutti i tuoi dati: profilo, misure, pasti,
          alimenti, ricette, regole, allenamenti, sonno, integratori, chat,
          correzioni, review e configurazione AI (senza API key in chiaro).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={busy}
        >
          <Download className="h-4 w-4" />
          {busy ? 'Preparazione…' : 'Esporta tutto (JSON)'}
        </Button>
      </CardContent>
    </Card>
  )
}
