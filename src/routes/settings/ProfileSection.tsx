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
  sex: z.enum(['male', 'female', 'other']).nullable(),
  birth_date: z.string().nullable(),
  height_cm: z
    .union([z.coerce.number().min(100).max(250), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  activity_level: z
    .enum(['sedentary', 'light', 'moderate', 'high', 'athlete'])
    .nullable(),
})

type FormValues = z.input<typeof schema>

export function ProfileSection() {
  const { data: profile, isLoading } = useProfile()
  const update = useUpdateProfile()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sex: null,
      birth_date: null,
      height_cm: null,
      activity_level: null,
    },
  })

  useEffect(() => {
    if (profile) {
      form.reset({
        sex: profile.sex,
        birth_date: profile.birth_date,
        height_cm: profile.height_cm,
        activity_level: profile.activity_level,
      })
    }
  }, [profile, form])

  async function onSubmit(values: FormValues) {
    try {
      await update.mutateAsync({
        sex: values.sex,
        birth_date: values.birth_date || null,
        height_cm:
          values.height_cm === null || values.height_cm === ''
            ? null
            : Number(values.height_cm),
        activity_level: values.activity_level,
      })
      toast.success('Profilo aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profilo</CardTitle>
        <CardDescription>
          Dati anagrafici e livello di attività giornaliero.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="sex">Sesso</Label>
            <Select
              value={form.watch('sex') ?? undefined}
              onValueChange={(v) =>
                form.setValue('sex', v as FormValues['sex'], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="sex">
                <SelectValue placeholder="Seleziona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Uomo</SelectItem>
                <SelectItem value="female">Donna</SelectItem>
                <SelectItem value="other">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">Data di nascita</Label>
            <Input
              id="birth_date"
              type="date"
              {...form.register('birth_date')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height_cm">Altezza (cm)</Label>
            <Input
              id="height_cm"
              type="number"
              step="0.1"
              min={100}
              max={250}
              placeholder="es. 177"
              {...form.register('height_cm')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_level">Livello di attività</Label>
            <Select
              value={form.watch('activity_level') ?? undefined}
              onValueChange={(v) =>
                form.setValue(
                  'activity_level',
                  v as FormValues['activity_level'],
                  { shouldDirty: true },
                )
              }
            >
              <SelectTrigger id="activity_level">
                <SelectValue placeholder="Seleziona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentario</SelectItem>
                <SelectItem value="light">Leggero</SelectItem>
                <SelectItem value="moderate">Moderato</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="athlete">Atleta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={update.isPending || isLoading || !form.formState.isDirty}
            >
              {update.isPending ? 'Salvataggio…' : 'Salva profilo'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
