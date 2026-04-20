import { ProfileSection } from './settings/ProfileSection'
import { GoalSection } from './settings/GoalSection'
import { TargetsSection } from './settings/TargetsSection'
import { MeasurementsSection } from './settings/MeasurementsSection'
import { AiSection } from './settings/AiSection'
import { SystemPromptSection } from './settings/SystemPromptSection'
import { ExportSection } from './settings/ExportSection'

export function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Impostazioni
        </p>
        <h2 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
          Profilo, AI & dati
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dati personali, obiettivo, misure, configurazione AI e backup.
        </p>
      </div>
      <ProfileSection />
      <GoalSection />
      <TargetsSection />
      <MeasurementsSection />
      <AiSection />
      <SystemPromptSection />
      <ExportSection />
    </div>
  )
}
