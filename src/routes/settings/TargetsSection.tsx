import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
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
import { Separator } from '@/components/ui/Separator'
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'
import { useLatestMeasurement } from '@/features/measurements/useMeasurements'
import { round0 } from '@/lib/macro'

export function TargetsSection() {
  const { data: profile } = useProfile()
  const { data: latest } = useLatestMeasurement()
  const update = useUpdateProfile()

  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carb, setCarb] = useState('')
  const [fat, setFat] = useState('')

  useEffect(() => {
    if (profile) {
      setKcal(profile.target_kcal != null ? String(profile.target_kcal) : '')
      setProtein(
        profile.target_protein_g != null
          ? String(profile.target_protein_g)
          : '',
      )
      setCarb(
        profile.target_carb_g != null ? String(profile.target_carb_g) : '',
      )
      setFat(profile.target_fat_g != null ? String(profile.target_fat_g) : '')
    }
  }, [profile])

  const p = num(protein)
  const c = num(carb)
  const f = num(fat)
  const computedKcalFromMacros = p * 4 + c * 4 + f * 9

  // Indicatore di coerenza fra kcal e macro
  const typedKcal = num(kcal)
  const kcalMismatch =
    typedKcal > 0 && computedKcalFromMacros > 0
      ? Math.abs(typedKcal - computedKcalFromMacros)
      : 0
  const showMismatch = kcalMismatch >= 50

  async function handleSave() {
    try {
      await update.mutateAsync({
        target_kcal: kcal === '' ? null : Math.round(num(kcal)),
        target_protein_g: protein === '' ? null : Math.round(num(protein)),
        target_carb_g: carb === '' ? null : Math.round(num(carb)),
        target_fat_g: fat === '' ? null : Math.round(num(fat)),
      })
      toast.success('Target aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  function handleCalculate() {
    const weight = latest?.weight_kg != null ? Number(latest.weight_kg) : null
    if (!weight || !profile?.height_cm || !profile?.sex || !profile?.birth_date) {
      toast.error(
        'Servono peso (misura), altezza, sesso e data di nascita nei dati profilo',
      )
      return
    }
    const age = ageFromBirthDate(profile.birth_date)
    const bmr =
      profile.sex === 'male'
        ? 10 * weight + 6.25 * Number(profile.height_cm) - 5 * age + 5
        : profile.sex === 'female'
          ? 10 * weight + 6.25 * Number(profile.height_cm) - 5 * age - 161
          : // fallback neutro
            10 * weight + 6.25 * Number(profile.height_cm) - 5 * age - 78

    const activityMul: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      high: 1.725,
      athlete: 1.9,
    }
    const mul = activityMul[profile.activity_level ?? 'moderate'] ?? 1.55
    const tdee = bmr * mul

    // Aggiustamento per tipo di fase
    const goalAdj: Record<string, number> = {
      cut: -400,
      bulk: 300,
      recomp: 0,
      maintain: 0,
    }
    const targetKcal = Math.round(tdee + (goalAdj[profile.goal_type ?? 'maintain'] ?? 0))

    // Macro split: P 1.8 g/kg (peso target se esiste altrimenti attuale),
    //              F 0.9 g/kg, C il resto
    const pRef =
      profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : weight
    const proteinG = Math.round(pRef * 1.8)
    const fatG = Math.round(pRef * 0.9)
    const remainKcal = targetKcal - proteinG * 4 - fatG * 9
    const carbG = Math.max(0, Math.round(remainKcal / 4))

    setKcal(String(targetKcal))
    setProtein(String(proteinG))
    setCarb(String(carbG))
    setFat(String(fatG))
    toast.success('Target suggeriti — ricorda di salvare')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target macro giornalieri</CardTitle>
        <CardDescription>
          Definisci kcal e macro da puntare oggi. Puoi inserirli a mano o
          calcolarli dai tuoi dati con la formula di Mifflin-St Jeor (TDEE
          aggiustato per fase).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <FieldTarget label="Kcal / giorno" value={kcal} onChange={setKcal} unit="kcal" />
          <FieldTarget label="Proteine" value={protein} onChange={setProtein} unit="g" />
          <FieldTarget label="Carboidrati" value={carb} onChange={setCarb} unit="g" />
          <FieldTarget label="Grassi" value={fat} onChange={setFat} unit="g" />
        </div>

        {showMismatch && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            I tuoi macro danno{' '}
            <span className="font-mono">{round0(computedKcalFromMacros)}</span>{' '}
            kcal (P·4 + C·4 + G·9), ma hai inserito{' '}
            <span className="font-mono">{round0(typedKcal)}</span> kcal. Sono
            ok tolleranze fino a 50 kcal (fibra/alcol), ma se scostano troppo
            rivedili.
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
          >
            {update.isPending ? 'Salvataggio…' : 'Salva target'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCalculate}
            title="Compila i campi con un calcolo basato sul tuo profilo"
          >
            <Sparkles className="h-4 w-4" />
            Calcola automaticamente
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Il calcolo automatico usa: BMR (Mifflin-St Jeor) × moltiplicatore
          attività, aggiustato di −400 kcal (cut) / +300 kcal (bulk) / 0 (recomp,
          mantenimento). Proteine 1.8 g/kg peso target, grassi 0.9 g/kg,
          carboidrati a riempimento.
        </p>
      </CardContent>
    </Card>
  )
}

function FieldTarget({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
}) {
  const id = `target_${label.toLowerCase().replace(/\W+/g, '_')}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 font-mono"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  )
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function ageFromBirthDate(iso: string): number {
  const b = new Date(iso)
  const today = new Date()
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}
