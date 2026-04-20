import { ProfileSection } from './settings/ProfileSection'
import { GoalSection } from './settings/GoalSection'
import { MeasurementsSection } from './settings/MeasurementsSection'
import { ExportSection } from './settings/ExportSection'

export function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Impostazioni
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Profilo & misure
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dati personali, obiettivo e storico misurazioni.
        </p>
      </div>
      <ProfileSection />
      <GoalSection />
      <MeasurementsSection />
      <ExportSection />
    </div>
  )
}
