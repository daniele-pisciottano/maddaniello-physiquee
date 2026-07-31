// Valutazioni nutrizionali deterministiche (Project Nutrition — Biasci).
//
// Il modello non deve ricavare a occhio le kcal/kg o decidere se serve un
// reset: lo calcoliamo qui e gli passiamo il verdetto. Riduce gli errori
// aritmetici e rende i consigli riproducibili.

export type NutritionFacts = {
  sex: 'male' | 'female' | 'other' | null
  weightKg: number | null
  bodyFatPct: number | null
  goalType: string | null
  targetKcal: number | null
  targetProteinG: number | null
  targetFatG: number | null
  /** Media kcal effettive degli ultimi giorni con log. */
  avgKcal7d: number | null
  avgProtein7d: number | null
  /** Giorni con almeno un pasto loggato negli ultimi 7. */
  daysLogged7d: number
  /** Variazione di peso negli ultimi 28 giorni, in kg. */
  weightDelta28d: number | null
}

export type CoachFinding = {
  severity: 'info' | 'warn' | 'block'
  code: string
  message: string
}

// Soglie del reset metabolico (kcal per kg di peso corporeo).
const RESET_THRESHOLD = { male: 31, female: 28, other: 30 }

// Proteine g/kg per fase.
const PROTEIN_RANGE: Record<string, [number, number]> = {
  cut: [1.7, 2.5],
  bulk: [0.9, 1.5],
  recomp: [1.6, 2.2],
  maintain: [1.4, 2.0],
}

export function analyzeNutrition(f: NutritionFacts): {
  findings: CoachFinding[]
  kcalPerKg: number | null
  proteinPerKg: number | null
  weeklyWeightChangePct: number | null
} {
  const findings: CoachFinding[] = []

  const kcalPerKg =
    f.weightKg && f.targetKcal
      ? Math.round((f.targetKcal / f.weightKg) * 10) / 10
      : null
  const proteinPerKg =
    f.weightKg && f.targetProteinG
      ? Math.round((f.targetProteinG / f.weightKg) * 100) / 100
      : null
  const weeklyWeightChangePct =
    f.weightDelta28d != null && f.weightKg
      ? Math.round(((f.weightDelta28d / 4 / f.weightKg) * 100) * 100) / 100
      : null

  // --- Gate del reset metabolico -------------------------------
  const threshold = RESET_THRESHOLD[f.sex ?? 'other'] ?? 30
  if (kcalPerKg != null && kcalPerKg < threshold) {
    const isCutting = f.goalType === 'cut'
    findings.push({
      severity: isCutting ? 'block' : 'warn',
      code: 'reset_needed',
      message: `Il target è ${kcalPerKg} kcal/kg, sotto la soglia di ${threshold} kcal/kg per ${f.sex === 'female' ? 'una donna' : 'un uomo'}.${
        isCutting
          ? ' Impostare un ulteriore deficit da qui porta al punto di rottura: la strada corretta è un reset metabolico (+40-100 kcal ogni 7-14 giorni) prima di tagliare ancora.'
          : ' Prima di qualsiasi definizione futura va alzato il fabbisogno.'
      }`,
    })
  } else if (kcalPerKg != null && kcalPerKg >= threshold + 4) {
    findings.push({
      severity: 'info',
      code: 'reset_done',
      message: `Fabbisogno impostato a ${kcalPerKg} kcal/kg: c'è margine metabolico sufficiente per gestire una definizione.`,
    })
  }

  // --- Proteine per fase ---------------------------------------
  if (proteinPerKg != null && f.goalType) {
    const range = PROTEIN_RANGE[f.goalType]
    if (range) {
      const [lo, hi] = range
      if (proteinPerKg < lo) {
        findings.push({
          severity: 'warn',
          code: 'protein_low',
          message: `Proteine a ${proteinPerKg} g/kg: sotto il range ${lo}-${hi} g/kg indicato per la fase "${f.goalType}". In deficit questo costa massa magra.`,
        })
      } else if (proteinPerKg > hi + 0.5) {
        findings.push({
          severity: 'info',
          code: 'protein_high',
          message: `Proteine a ${proteinPerKg} g/kg, sopra il range ${lo}-${hi} g/kg: non è dannoso ma sottrae spazio a carboidrati e grassi.`,
        })
      }
    }
  }

  // --- Grassi minimi -------------------------------------------
  if (f.targetFatG != null && f.targetFatG < 30) {
    findings.push({
      severity: 'warn',
      code: 'fat_too_low',
      message: `Grassi a ${f.targetFatG} g/die: sotto il minimo di 20-30 g necessario per la funzione ormonale.`,
    })
  }

  // --- Velocità di variazione del peso -------------------------
  if (weeklyWeightChangePct != null && f.goalType) {
    if (f.goalType === 'cut' && weeklyWeightChangePct < -1.2) {
      findings.push({
        severity: 'warn',
        code: 'cut_too_fast',
        message: `Perdita di ${Math.abs(weeklyWeightChangePct)}% a settimana: oltre il limite dell'1% raccomandato. A questa velocità una quota rilevante di quello che se ne va è massa magra.`,
      })
    }
    if (
      f.goalType === 'cut' &&
      weeklyWeightChangePct > -0.1 &&
      f.daysLogged7d >= 5
    ) {
      findings.push({
        severity: 'info',
        code: 'cut_stalled',
        message: `Peso sostanzialmente fermo nelle ultime 4 settimane pur essendo in fase di definizione. Prima di tagliare ancora, verifica aderenza reale, sonno e stress: se le kcal/kg sono già basse la risposta corretta è una ricarica o un diet break, non un ulteriore deficit.`,
      })
    }
    if (f.goalType === 'bulk' && weeklyWeightChangePct > 0.7) {
      findings.push({
        severity: 'warn',
        code: 'bulk_too_fast',
        message: `Aumento di ${weeklyWeightChangePct}% a settimana: oltre il range 0,25-0,5% della massa pulita. Il surplus è troppo alto e sta aggiungendo soprattutto grasso.`,
      })
    }
  }

  // --- Aderenza / qualità del dato -----------------------------
  if (f.daysLogged7d < 4) {
    findings.push({
      severity: 'warn',
      code: 'low_logging',
      message: `Solo ${f.daysLogged7d} giorni su 7 con pasti loggati: i dati non bastano per valutare il trend. "Senza dati sono tutti atti di fede" — prima di cambiare i target serve almeno una settimana tracciata.`,
    })
  } else if (
    f.avgKcal7d != null &&
    f.targetKcal != null &&
    Math.abs(f.avgKcal7d - f.targetKcal) / f.targetKcal > 0.15
  ) {
    const dir = f.avgKcal7d > f.targetKcal ? 'sopra' : 'sotto'
    findings.push({
      severity: 'warn',
      code: 'target_drift',
      message: `Media reale ${Math.round(f.avgKcal7d)} kcal contro un target di ${f.targetKcal}: sei costantemente ${dir} del ${Math.round((Math.abs(f.avgKcal7d - f.targetKcal) / f.targetKcal) * 100)}%. Il problema non è il target, è l'aderenza: non ha senso ricalcolare i numeri prima di averli rispettati.`,
    })
  }

  if (
    f.avgProtein7d != null &&
    f.targetProteinG != null &&
    f.avgProtein7d < f.targetProteinG * 0.8 &&
    f.daysLogged7d >= 4
  ) {
    findings.push({
      severity: 'warn',
      code: 'protein_adherence',
      message: `Proteine reali in media ${Math.round(f.avgProtein7d)}g contro un target di ${f.targetProteinG}g: è il macro più spesso mancato e il più importante da centrare.`,
    })
  }

  return { findings, kcalPerKg, proteinPerKg, weeklyWeightChangePct }
}

export function formatFindings(
  findings: CoachFinding[],
  title: string,
): string | null {
  if (findings.length === 0) return null
  const icon = { block: '⛔', warn: '⚠️', info: 'ℹ️' }
  const lines = findings.map((f) => `- ${icon[f.severity]} ${f.message}`)
  return `## ${title}\n${lines.join('\n')}`
}
