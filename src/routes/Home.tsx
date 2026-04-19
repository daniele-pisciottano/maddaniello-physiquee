import { useAuth } from '@/features/auth/AuthProvider'

export function Home() {
  const { user } = useAuth()
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Benvenuto
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Ciao.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Kcal oggi" value="—" unit="kcal" />
        <MetricCard label="Proteine" value="—" unit="g" />
        <MetricCard label="Peso" value="—" unit="kg" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Fase 0 completata ✓</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Scaffold base, auth, PWA manifest, routing e design system attivi. Le
          metriche sopra sono placeholder: verranno popolate in Fase 1
          (profilo/misure) e Fase 2 (log pasti).
        </p>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  )
}
