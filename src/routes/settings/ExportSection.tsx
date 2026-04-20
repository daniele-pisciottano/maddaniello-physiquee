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
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import { useAuth } from '@/features/auth/AuthProvider'

export function ExportSection() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: measurements } = useMeasurements()

  function handleExport() {
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        user: { id: user?.id, email: user?.email },
        profile,
        measurements,
      }
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
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dati</CardTitle>
        <CardDescription>
          Scarica una copia JSON di profilo e misure. In fasi successive
          includerà anche pasti, allenamenti, chat e knowledge base.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Esporta JSON
        </Button>
      </CardContent>
    </Card>
  )
}
