import { WorkoutsSection } from './training/WorkoutsSection'
import { SleepSection } from './training/SleepSection'
import { SupplementsSection } from './training/SupplementsSection'

export function Training() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Training
        </p>
        <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          Allenamenti, sonno, integratori
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contesto complementare che l'AI considera per consigli su recupero e
          performance.
        </p>
      </div>

      <WorkoutsSection />
      <SleepSection />
      <SupplementsSection />
    </div>
  )
}
