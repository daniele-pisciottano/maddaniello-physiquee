import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'

const schema = z.object({
  goal_type: z.enum(['cut', 'bulk', 'recomp', 'maintain']).nullable(),
  goal_weight_kg: z
    .union([z.coerce.number().min(30).max(300), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  goal_body_fat_pct: z
    .union([z.coerce.number().min(3).max(60), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  goal_deadline: z.string().nullable(),
})

type FormValues = z.input<typeof schema>

export function GoalSection() {
  const { data: profile, isLoading } = useProfile()
  const update = useUpdateProfile()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      goal_type: null,
      goal_weight_kg: null,
      goal_body_fat_pct: null,
      goal_deadline: null,
    },
  })

  useEffect(() => {
    if (profile) {
      form.reset({
        goal_type: profile.goal_type,
        goal_weight_kg: profile.goal_weight_kg,
        goal_body_fat_pct: profile.goal_body_fat_pct,
        goal_deadline: profile.goal_deadline,
      })
    }
  }, [profile, form])

  async function onSubmit(values: FormValues) {
    try {
      await update.mutateAsync({
        goal_type: values.goal_type,
        goal_weight_kg:
          values.goal_weight_kg === null || values.goal_weight_kg === ''
            ? null
            : Number(values.goal_weight_kg),
        goal_body_fat_pct:
          values.goal_body_fat_pct === null || values.goal_body_fat_pct === ''
            ? null
            : Number(values.goal_body_fat_pct),
        goal_deadline: values.goal_deadline || null,
      })
      toast.success('Obiettivo aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obiettivo</CardTitle>
        <CardDescription>
          Tipo di fase, peso target e scadenza. L'AI userà questi valori per
          suggerire kcal e macro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="goal_type">Tipo di fase</Label>
            <Select
              value={form.watch('goal_type') ?? undefined}
              onValueChange={(v) =>
                form.setValue('goal_type', v as FormValues['goal_type'], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="goal_type">
                <SelectValue placeholder="Seleziona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cut">Definizione (cut)</SelectItem>
                <SelectItem value="bulk">Massa (bulk)</SelectItem>
                <SelectItem value="recomp">Ricomposizione</SelectItem>
                <SelectItem value="maintain">Mantenimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal_deadline">Scadenza</Label>
            <Input
              id="goal_deadline"
              type="date"
              {...form.register('goal_deadline')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal_weight_kg">Peso target (kg)</Label>
            <Input
              id="goal_weight_kg"
              type="number"
              step="0.1"
              min={30}
              max={300}
              placeholder="es. 80"
              {...form.register('goal_weight_kg')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal_body_fat_pct">Body fat target (%)</Label>
            <Input
              id="goal_body_fat_pct"
              type="number"
              step="0.1"
              min={3}
              max={60}
              placeholder="es. 12"
              {...form.register('goal_body_fat_pct')}
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={update.isPending || isLoading || !form.formState.isDirty}
            >
              {update.isPending ? 'Salvataggio…' : 'Salva obiettivo'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
