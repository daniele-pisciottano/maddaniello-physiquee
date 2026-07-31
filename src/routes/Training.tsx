import { Link } from 'react-router-dom'
import { WorkoutsSection } from './training/WorkoutsSection'
import { SleepSection } from './training/SleepSection'
import { SupplementsSection } from './training/SupplementsSection'

export function Training() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Recupero
        </p>
        <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          Cardio, sonno, integratori
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Attività generiche e contesto di recupero. Per le sedute di pesi con
          serie, carichi e schede usa{' '}
          <Link to="/allenamento" className="text-primary hover:underline">
            Allenamento
          </Link>
          .
        </p>
      </div>

      <WorkoutsSection />
      <SleepSection />
      <SupplementsSection />
    </div>
  )
}
