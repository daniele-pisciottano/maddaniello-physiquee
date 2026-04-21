import { ProfileSection } from './settings/ProfileSection'
import { GoalSection } from './settings/GoalSection'
import { TargetsSection } from './settings/TargetsSection'
import { MeasurementsSection } from './settings/MeasurementsSection'
import { DietaryRulesSection } from './settings/DietaryRulesSection'
import { MealPlanSection } from './settings/MealPlanSection'
import { AiSection } from './settings/AiSection'
import { SystemPromptSection } from './settings/SystemPromptSection'
import { CorrectionsSection } from './settings/CorrectionsSection'
import { KnowledgeSection } from './settings/KnowledgeSection'
import { ExportSection } from './settings/ExportSection'
import { DangerZoneSection } from './settings/DangerZoneSection'

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
      <DietaryRulesSection />
      <MealPlanSection />
      <AiSection />
      <SystemPromptSection />
      <CorrectionsSection />
      <KnowledgeSection />
      <ExportSection />
      <DangerZoneSection />
    </div>
  )
}
