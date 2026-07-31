// Valutazioni sull'allenamento (Project Exercise — Roncari) calcolate
// deterministicamente dal log delle sessioni.
//
// L'AI riceve i numeri già aggregati (serie per gruppo muscolare,
// bilanciamento spinta/trazione, trend dei carichi) invece di doverli
// dedurre da un elenco di sessioni.

import type { CoachFinding } from './nutrition-rules'

export type SetRecord = {
  exerciseId: string
  exerciseName: string
  primaryMuscle: string
  secondaryMuscles: string[]
  movementPattern: string | null
  discouraged: boolean
  discouragedReason: string | null
  weightKg: number | null
  reps: number | null
  rpe: number | null
  setType: string
  performedAt: string
}

export type TrainingAnalysis = {
  findings: CoachFinding[]
  /** Serie allenanti per gruppo muscolare nelle ultime N settimane, per settimana. */
  weeklySetsByMuscle: Array<{ muscle: string; setsPerWeek: number }>
  sessionsPerWeek: number
  patternBalance: {
    push: number
    pull: number
    kneeDominant: number
    hipDominant: number
  }
  /** Esercizi con carico fermo o in calo su almeno 3 sessioni. */
  stalled: Array<{ exerciseName: string; sessions: number; best1rm: number }>
}

// Range di riferimento del volume settimanale per gruppo muscolare.
const MIN_WEEKLY_SETS = 10
const MAX_WEEKLY_SETS = 20

// Gruppi per cui il conteggio "serie dirette" non ha senso come i grandi
// distretti: non generano warning di volume basso.
const NO_VOLUME_WARNING = new Set([
  'avambracci',
  'quadrato_lombi',
  'obliqui',
  'erettori_spinali',
  'cardio',
  'adduttori',
  'abduttori',
])

// Distretti principali su cui vale la pena segnalare il volume mancante.
const MAJOR_MUSCLES = [
  'petto',
  'dorso',
  'quadricipiti',
  'ischiocrurali',
  'glutei',
  'deltoide_laterale',
  'bicipiti',
  'tricipiti',
]

const PUSH_PATTERNS = new Set(['push_h', 'push_v'])
const PULL_PATTERNS = new Set(['pull_h', 'pull_v'])
const KNEE_PATTERNS = new Set(['squat', 'lunge'])
const HIP_PATTERNS = new Set(['hinge'])

export function analyzeTraining(
  sets: SetRecord[],
  weeks: number,
  sessionCount: number,
): TrainingAnalysis {
  const findings: CoachFinding[] = []
  const sessionsPerWeek = Math.round((sessionCount / weeks) * 10) / 10

  // --- Volume per gruppo muscolare -----------------------------
  // Il muscolo primario conta 1 serie, i secondari 0,5.
  const setsByMuscle = new Map<string, number>()
  const patternBalance = { push: 0, pull: 0, kneeDominant: 0, hipDominant: 0 }

  for (const s of sets) {
    if (s.setType === 'warmup') continue
    setsByMuscle.set(
      s.primaryMuscle,
      (setsByMuscle.get(s.primaryMuscle) ?? 0) + 1,
    )
    for (const m of s.secondaryMuscles) {
      setsByMuscle.set(m, (setsByMuscle.get(m) ?? 0) + 0.5)
    }
    const p = s.movementPattern
    if (p && PUSH_PATTERNS.has(p)) patternBalance.push += 1
    if (p && PULL_PATTERNS.has(p)) patternBalance.pull += 1
    if (p && KNEE_PATTERNS.has(p)) patternBalance.kneeDominant += 1
    if (p && HIP_PATTERNS.has(p)) patternBalance.hipDominant += 1
  }

  const weeklySetsByMuscle = [...setsByMuscle.entries()]
    .map(([muscle, total]) => ({
      muscle,
      setsPerWeek: Math.round((total / weeks) * 10) / 10,
    }))
    .sort((a, b) => b.setsPerWeek - a.setsPerWeek)

  if (sets.length === 0) {
    return {
      findings: [
        {
          severity: 'info',
          code: 'no_training_data',
          message:
            'Nessuna sessione di forza registrata: non è possibile valutare volume, frequenza o progressioni.',
        },
      ],
      weeklySetsByMuscle: [],
      sessionsPerWeek,
      patternBalance,
      stalled: [],
    }
  }

  // --- Volume basso o eccessivo --------------------------------
  const trained = new Map(weeklySetsByMuscle.map((r) => [r.muscle, r.setsPerWeek]))
  const under: string[] = []
  const over: string[] = []
  for (const m of MAJOR_MUSCLES) {
    const v = trained.get(m) ?? 0
    if (v < MIN_WEEKLY_SETS) under.push(`${m} (${v})`)
  }
  for (const { muscle, setsPerWeek } of weeklySetsByMuscle) {
    if (NO_VOLUME_WARNING.has(muscle)) continue
    if (setsPerWeek > MAX_WEEKLY_SETS) over.push(`${muscle} (${setsPerWeek})`)
  }

  if (under.length > 0) {
    findings.push({
      severity: 'warn',
      code: 'volume_low',
      message: `Sotto le ${MIN_WEEKLY_SETS} serie settimanali di riferimento: ${under.join(', ')}. Serie/settimana calcolate su ${weeks} settimane, muscolo primario 1 e secondari 0,5.`,
    })
  }
  if (over.length > 0) {
    findings.push({
      severity: 'info',
      code: 'volume_high',
      message: `Sopra le ${MAX_WEEKLY_SETS} serie settimanali: ${over.join(', ')}. Non è un errore in sé, ma va giustificato dal livello e dal recupero effettivo.`,
    })
  }

  // --- Frequenza -----------------------------------------------
  if (sessionsPerWeek < 2) {
    findings.push({
      severity: 'warn',
      code: 'frequency_low',
      message: `Media di ${sessionsPerWeek} sedute a settimana: sotto le 3-4 indicate per costruire massa magra e sostenere il partizionamento calorico.`,
    })
  }

  // --- Bilanciamento dei pattern -------------------------------
  const { push, pull, kneeDominant, hipDominant } = patternBalance
  if (push + pull >= 12) {
    const ratio = pull === 0 ? Infinity : push / pull
    if (ratio > 1.5) {
      findings.push({
        severity: 'warn',
        code: 'push_pull_imbalance',
        message: `Rapporto spinta/trazione ${push}:${pull}. Lo squilibrio cronico verso le spinte è una delle cause più comuni di problemi di spalla: il rapporto va tenuto almeno 1:1.`,
      })
    } else if (ratio < 0.6) {
      findings.push({
        severity: 'info',
        code: 'pull_dominant',
        message: `Rapporto spinta/trazione ${push}:${pull}, sbilanciato verso le trazioni. Va bene in chi sta in ufficio tutto il giorno, ma verifica che le spinte non siano trascurate.`,
      })
    }
  }
  if (kneeDominant + hipDominant >= 8) {
    const ratio = hipDominant === 0 ? Infinity : kneeDominant / hipDominant
    if (ratio > 2) {
      findings.push({
        severity: 'warn',
        code: 'knee_hip_imbalance',
        message: `Movimenti di ginocchio (squat/affondi) ${kneeDominant} contro ${hipDominant} di anca (hinge/stacchi). Manca lavoro sulla catena posteriore: stacco rumeno, hip thrust e leg curl.`,
      })
    } else if (ratio < 0.4) {
      findings.push({
        severity: 'info',
        code: 'hip_dominant',
        message: `Molto lavoro d'anca (${hipDominant}) rispetto al ginocchio (${kneeDominant}): i quadricipiti stanno ricevendo poco stimolo diretto.`,
      })
    }
  }

  // --- Esercizi sconsigliati dalla letteratura -----------------
  const discouraged = new Map<string, string>()
  for (const s of sets) {
    if (s.discouraged && !discouraged.has(s.exerciseName)) {
      discouraged.set(s.exerciseName, s.discouragedReason ?? '')
    }
  }
  if (discouraged.size > 0) {
    findings.push({
      severity: 'warn',
      code: 'discouraged_exercise',
      message: `Esercizi in scheda che la letteratura del libro sconsiglia: ${[...discouraged.entries()].map(([n, r]) => `${n}${r ? ` (${r})` : ''}`).join('; ')}.`,
    })
  }

  // --- Stallo sui carichi --------------------------------------
  const stalled = detectStalls(sets)
  if (stalled.length > 0) {
    findings.push({
      severity: 'info',
      code: 'stalled_lifts',
      message: `Massimale stimato fermo o in calo da almeno 3 sedute su: ${stalled.map((s) => `${s.exerciseName} (~${s.best1rm} kg)`).join(', ')}. Prima di cambiare esercizio verifica recupero, aderenza al range di ripetizioni e se il deficit calorico è compatibile con una progressione.`,
    })
  }

  return {
    findings,
    weeklySetsByMuscle,
    sessionsPerWeek,
    patternBalance,
    stalled,
  }
}

// Epley — stessa formula delle RPC SQL e del client.
function est1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

function detectStalls(
  sets: SetRecord[],
): Array<{ exerciseName: string; sessions: number; best1rm: number }> {
  // Miglior 1RM stimato per (esercizio, giorno).
  const byExercise = new Map<
    string,
    { name: string; byDay: Map<string, number> }
  >()
  for (const s of sets) {
    if (s.setType === 'warmup' || !s.weightKg || !s.reps) continue
    const day = s.performedAt.slice(0, 10)
    let entry = byExercise.get(s.exerciseId)
    if (!entry) {
      entry = { name: s.exerciseName, byDay: new Map() }
      byExercise.set(s.exerciseId, entry)
    }
    const e = est1rm(Number(s.weightKg), Number(s.reps))
    entry.byDay.set(day, Math.max(entry.byDay.get(day) ?? 0, e))
  }

  const result: Array<{
    exerciseName: string
    sessions: number
    best1rm: number
  }> = []
  for (const { name, byDay } of byExercise.values()) {
    const series = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v)
    if (series.length < 3) continue
    const recent = series.slice(-3)
    const peak = Math.max(...series)
    // Nessuna delle ultime 3 sedute ha migliorato il picco storico.
    if (Math.max(...recent) < peak * 1.005 && recent[2] <= recent[0] * 1.01) {
      result.push({
        exerciseName: name,
        sessions: series.length,
        best1rm: Math.round(peak * 10) / 10,
      })
    }
  }
  return result.slice(0, 5)
}

export function formatTrainingContext(a: TrainingAnalysis, weeks: number): string {
  const parts: string[] = [`## Allenamento — analisi ultime ${weeks} settimane`]
  parts.push(`Frequenza: ${a.sessionsPerWeek} sedute/settimana.`)

  if (a.weeklySetsByMuscle.length > 0) {
    const top = a.weeklySetsByMuscle
      .filter((r) => r.setsPerWeek >= 1)
      .map((r) => `${r.muscle} ${r.setsPerWeek}`)
      .join(' · ')
    parts.push(`Serie allenanti/settimana per gruppo: ${top}`)
    parts.push(
      `Riferimento: 10-20 serie/settimana per gruppo muscolare. Primario 1 serie, secondari 0,5.`,
    )
  }

  const { push, pull, kneeDominant, hipDominant } = a.patternBalance
  if (push + pull + kneeDominant + hipDominant > 0) {
    parts.push(
      `Pattern: spinte ${push} · trazioni ${pull} · ginocchio ${kneeDominant} · anca ${hipDominant}`,
    )
  }

  return parts.join('\n')
}
