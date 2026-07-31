// Coach allenamento: analizza schede e log, propone programmi e
// progressioni. Ragiona sui principi di "Project Exercise" (Roncari) e
// sui rilievi calcolati dal motore di regole, non a sensazione.

import type { Handler } from '@netlify/functions'
import { getAuthedUserId, serviceClient } from './_lib/supabase'
import { chat, type ChatMessage } from './_lib/ai-call'
import { costUsdCents } from './_lib/pricing'
import { recordUsage } from './_lib/budget'
import { resolveAiContext, extractJson } from './_lib/ai-resolve'
import { ok, fail, parseJson } from './_lib/http'
import { selectKnowledge } from './_lib/kb'
import { analyzeTraining, formatTrainingContext } from './_lib/coach/training-rules'
import { formatRecentSessions, loadTrainingSets } from './_lib/coach/training-data'

type Action = 'analyze_routine' | 'generate_routine' | 'progression' | 'review'

type Body = {
  action: Action
  routineId?: string
  /** Richiesta libera dell'utente per la generazione ("3 giorni, full body"). */
  brief?: string
  exerciseId?: string
}

const ANALYSIS_WEEKS = 6
const MAX_BRIEF_LEN = 1500

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'Method not allowed')

  const userId = await getAuthedUserId(event.headers as Record<string, string>)
  if (!userId) return fail(401, 'Unauthorized')

  const body = parseJson<Body>(event.body)
  if (!body?.action) return fail(400, 'action richiesta')
  if (body.brief && body.brief.length > MAX_BRIEF_LEN) {
    return fail(400, `Richiesta troppo lunga (max ${MAX_BRIEF_LEN} caratteri)`)
  }

  const supabase = serviceClient()
  const resolved = await resolveAiContext(supabase, userId)
  if (resolved.error) return fail(resolved.error.status, resolved.error.message)
  const { provider, apiKey, model, budgetCents, spentCents } = resolved.ai

  // --- Dati comuni ---------------------------------------------
  const [{ sets, sessions }, profile, catalog] = await Promise.all([
    loadTrainingSets(supabase, userId, ANALYSIS_WEEKS),
    loadProfileBrief(supabase, userId),
    loadCatalogBrief(supabase, userId),
  ])
  const analysis = analyzeTraining(sets, ANALYSIS_WEEKS, sessions.length)

  let prompt: string
  let jsonMode = false
  let maxTokens = 2500

  switch (body.action) {
    case 'generate_routine': {
      if (!body.brief?.trim()) {
        return fail(400, 'Descrivi cosa vuoi dal programma')
      }
      prompt = buildGeneratePrompt(body.brief.trim(), profile, analysis, catalog)
      jsonMode = true
      maxTokens = 4000
      break
    }
    case 'analyze_routine': {
      if (!body.routineId) return fail(400, 'routineId richiesto')
      const routine = await loadRoutine(supabase, userId, body.routineId)
      if (!routine) return fail(404, 'Scheda non trovata')
      prompt = buildAnalyzePrompt(routine, profile, analysis)
      break
    }
    case 'progression': {
      if (!body.routineId) return fail(400, 'routineId richiesto')
      const routine = await loadRoutine(supabase, userId, body.routineId)
      if (!routine) return fail(404, 'Scheda non trovata')
      prompt = buildProgressionPrompt(routine, analysis, sets)
      break
    }
    case 'review': {
      prompt = buildReviewPrompt(profile, analysis, sessions, sets)
      break
    }
    default:
      return fail(400, 'action non valida')
  }

  const kb = selectKnowledge(body.brief ?? '', { includeTraining: true })
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM}\n\n${kb.text}` },
    { role: 'user', content: prompt },
  ]

  let result
  try {
    result = await chat(provider, apiKey, model, messages, {
      temperature: 0.3,
      maxTokens,
      jsonMode,
    })
  } catch (err) {
    return fail(502, err instanceof Error ? err.message : 'AI call fallita')
  }

  const cost = costUsdCents(provider, model, result.tokens_in, result.tokens_out)
  await recordUsage(
    supabase,
    userId,
    provider,
    model,
    result.tokens_in,
    result.tokens_out,
    cost,
  )

  const payload: Record<string, unknown> = {
    action: body.action,
    model: result.model,
    cost_cents: cost,
    budget_remaining_cents: Math.max(0, budgetCents - spentCents - cost),
    findings: analysis.findings,
    weekly_sets: analysis.weeklySetsByMuscle,
  }

  if (jsonMode) {
    const parsed = extractJson<GeneratedProgram>(result.text)
    if (!parsed) return fail(502, "L'AI non ha restituito un programma valido")
    const sanitized = sanitizeProgram(parsed, catalog)
    if (!sanitized) {
      return fail(502, 'Il programma generato non contiene esercizi validi')
    }
    payload.program = sanitized
  } else {
    const text = (result.text || '').trim()
    if (!text) return fail(502, "L'AI non ha restituito testo")
    payload.text = text
  }

  return ok(payload)
}

// --------------------------------------------------------------
// Prompt
// --------------------------------------------------------------

const SYSTEM = `Sei un preparatore esperto di sala pesi, italiano. Ragioni secondo "Project Exercise" di Andrea Roncari: biomeccanica prima delle mode, analisi del movimento, prevenzione degli infortuni cronici, rispetto dell'anatomia individuale.
Sei concreto e sintetico. Dai numeri (serie, ripetizioni, kg, recuperi) e motivi le scelte in una riga, senza lezioni teoriche.
Non inventi dati che non ti sono stati forniti. Se un'informazione manca lo dici invece di stimarla.
Per dolori persistenti o patologie diagnosticate rimandi a un fisioterapista.`

function buildGeneratePrompt(
  brief: string,
  profile: ProfileBrief | null,
  analysis: ReturnType<typeof analyzeTraining>,
  catalog: CatalogEntry[],
): string {
  return `Costruisci un programma di allenamento.

RICHIESTA DELL'UTENTE:
${brief}

${formatProfile(profile)}

${formatTrainingContext(analysis, ANALYSIS_WEEKS)}
${analysis.findings.length ? `\nRilievi sul suo storico:\n${analysis.findings.map((f) => `- ${f.message}`).join('\n')}` : ''}

ESERCIZI DISPONIBILI (usa SOLO questi, indicando l'id esatto):
${catalog.map((e) => `${e.id} · ${e.name} [${e.primary_muscle}${e.movement_pattern ? `, ${e.movement_pattern}` : ''}${e.discouraged ? ', SCONSIGLIATO' : ''}]`).join('\n')}

REGOLE DI PROGRAMMAZIONE:
- 10-20 serie allenanti a settimana per gruppo muscolare principale.
- Rapporto spinte/trazioni almeno 1:1; per ogni pattern di ginocchio (squat/affondo) prevedi un pattern d'anca (hinge).
- I multiarticolari fondamentali vanno all'inizio della seduta, poi i complementari, poi l'isolamento.
- Non usare esercizi marcati SCONSIGLIATO.
- Recuperi: 150-210s sui fondamentali, 90-120s sui complementari, 60-90s sull'isolamento.
- Range di ripetizioni coerente con l'obiettivo dichiarato.

Rispondi SOLO con questo JSON, senza testo attorno:
{
  "program_name": "nome breve del programma",
  "goal": "hypertrophy" | "strength" | "reset" | "cut" | "maintain",
  "days_per_week": numero,
  "weeks_planned": numero,
  "rationale": "2-4 frasi sul perché di questa struttura",
  "routines": [
    {
      "name": "es. Giorno A — Spinta",
      "weekday": numero 0-6 oppure null,
      "notes": "nota breve o null",
      "exercises": [
        {
          "exercise_id": "uuid preso dalla lista",
          "target_sets": numero,
          "rep_min": numero,
          "rep_max": numero,
          "target_rpe": numero 6-10 oppure null,
          "rest_sec": numero,
          "superset_group": numero oppure null,
          "notes": "cue o nota tecnica breve, oppure null"
        }
      ]
    }
  ]
}`
}

function buildAnalyzePrompt(
  routine: LoadedRoutine,
  profile: ProfileBrief | null,
  analysis: ReturnType<typeof analyzeTraining>,
): string {
  return `Analizza questa scheda e dì cosa funziona e cosa no.

SCHEDA "${routine.name}"${routine.description ? ` — ${routine.description}` : ''}
${routine.exercises
  .map(
    (e, i) =>
      `${i + 1}. ${e.name} [${e.primary_muscle}${e.movement_pattern ? `, ${e.movement_pattern}` : ''}] — ${e.target_sets} serie${e.rep_min ? ` × ${e.rep_min}-${e.rep_max ?? e.rep_min}` : ''}${e.rest_sec ? `, rec ${e.rest_sec}s` : ''}${e.discouraged ? ` ⚠️ SCONSIGLIATO: ${e.discouraged_reason ?? ''}` : ''}`,
  )
  .join('\n')}

Serie per gruppo muscolare in questa singola seduta:
${formatRoutineVolume(routine)}

${formatProfile(profile)}

${formatTrainingContext(analysis, ANALYSIS_WEEKS)}
${analysis.findings.length ? `\nRilievi automatici sul suo storico:\n${analysis.findings.map((f) => `- ${f.message}`).join('\n')}` : ''}

Struttura la risposta così, in markdown, senza titoli H1/H2:
**Cosa funziona** — 2-3 punti.
**Cosa cambierei** — massimo 4 punti, ognuno con la modifica concreta (quale esercizio, quante serie, cosa al suo posto) e una riga di motivazione biomeccanica.
**Ordine consigliato** — se l'ordine attuale non è ottimale, l'elenco corretto.
Se la scheda va bene così, dillo senza inventare problemi.`
}

function buildProgressionPrompt(
  routine: LoadedRoutine,
  analysis: ReturnType<typeof analyzeTraining>,
  sets: Awaited<ReturnType<typeof loadTrainingSets>>['sets'],
): string {
  const perExercise = new Map<
    string,
    { name: string; best: string[]; }
  >()
  for (const s of sets) {
    if (s.setType === 'warmup' || !s.weightKg || !s.reps) continue
    if (!routine.exercises.some((e) => e.exercise_id === s.exerciseId)) continue
    const entry = perExercise.get(s.exerciseId) ?? { name: s.exerciseName, best: [] }
    entry.best.push(
      `${s.performedAt.slice(0, 10)}: ${s.weightKg}kg × ${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ''}`,
    )
    perExercise.set(s.exerciseId, entry)
  }

  const history = [...perExercise.values()]
    .map((e) => `**${e.name}**\n${e.best.slice(-8).join('\n')}`)
    .join('\n\n')

  return `Prepara la prossima seduta della scheda "${routine.name}": per ogni esercizio indica carico e ripetizioni da fare.

ESERCIZI IN SCHEDA:
${routine.exercises
  .map(
    (e) =>
      `- ${e.name}: ${e.target_sets} serie${e.rep_min ? ` × ${e.rep_min}-${e.rep_max ?? e.rep_min}` : ''}${e.target_rpe ? ` @RPE ${e.target_rpe}` : ''}`,
  )
  .join('\n')}

STORICO REALE DELLE ULTIME SEDUTE:
${history || 'Nessuno storico su questi esercizi: è la prima volta che li esegue.'}

${analysis.stalled.length ? `Esercizi in stallo rilevati: ${analysis.stalled.map((s) => s.exerciseName).join(', ')}.` : ''}

REGOLE:
- Si sale di carico solo quando il numero di ripetizioni del range è stato completato su tutte le serie.
- Sui fondamentali incrementi di 2,5-5 kg; sull'isolamento 1-2,5 kg.
- In stallo da 3+ sedute: non aumentare il carico. Proponi una delle alternative (ripetizioni aggiuntive nel range, back-off set, fermo in buca, scarico) e spiega quale e perché in una riga.
- Se non c'è storico per un esercizio, indica di trovare il carico con una serie di prova invece di inventare un numero.

Rispondi con una tabella markdown: Esercizio | Serie × ripetizioni | Carico | Nota. Sotto, massimo 3 righe di commento complessivo.`
}

function buildReviewPrompt(
  profile: ProfileBrief | null,
  analysis: ReturnType<typeof analyzeTraining>,
  sessions: Awaited<ReturnType<typeof loadTrainingSets>>['sessions'],
  sets: Awaited<ReturnType<typeof loadTrainingSets>>['sets'],
): string {
  if (sessions.length === 0) {
    return `L'utente non ha ancora registrato nessuna sessione di allenamento strutturata.
${formatProfile(profile)}
Spiega in massimo 5 righe cosa gli conviene tracciare per primo e perché, senza fare la predica.`
  }
  return `Fai il punto sull'allenamento delle ultime ${ANALYSIS_WEEKS} settimane.

${formatProfile(profile)}

${formatTrainingContext(analysis, ANALYSIS_WEEKS)}

${analysis.findings.length ? `Rilievi automatici:\n${analysis.findings.map((f) => `- ${f.message}`).join('\n')}` : 'Nessun rilievo automatico.'}

Ultime sedute:
${formatRecentSessions(sessions, sets, 8).join('\n')}

Struttura, in markdown senza titoli H1/H2:
**Il punto** — 2-3 righe su come sta andando davvero.
**Priorità** — massimo 3 interventi concreti, in ordine di importanza, ognuno con il numero (quante serie, quale esercizio, quale frequenza).
**Da non toccare** — cosa sta funzionando e va lasciato stare.
Basati sui numeri che ti ho dato: non stimare valori che non hai.`
}

// --------------------------------------------------------------
// Loader
// --------------------------------------------------------------

type ProfileBrief = {
  sex: string | null
  birth_date: string | null
  goal_type: string | null
  weight_kg: number | null
  target_kcal: number | null
}

async function loadProfileBrief(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<ProfileBrief | null> {
  const [{ data: p }, { data: m }] = await Promise.all([
    supabase
      .from('profile')
      .select('sex, birth_date, goal_type, target_kcal')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('measurements')
      .select('weight_kg')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (!p) return null
  return {
    sex: p.sex,
    birth_date: p.birth_date,
    goal_type: p.goal_type,
    target_kcal: p.target_kcal,
    weight_kg: m?.weight_kg != null ? Number(m.weight_kg) : null,
  }
}

type CatalogEntry = {
  id: string
  name: string
  primary_muscle: string
  movement_pattern: string | null
  discouraged: boolean
}

// Solo tier 1-2 più i custom dell'utente: il catalogo completo occuperebbe
// troppo prompt e spingerebbe il modello verso l'isolamento.
async function loadCatalogBrief(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
): Promise<CatalogEntry[]> {
  const { data } = await supabase
    .from('exercise_catalog')
    .select('id, name, primary_muscle, movement_pattern, discouraged, tier, user_id')
    .eq('archived', false)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('tier')
    .order('name')
  return ((data ?? []) as Array<CatalogEntry & { tier: number; user_id: string | null }>)
    .filter((e) => e.tier <= 2 || e.user_id === userId)
    .map(({ id, name, primary_muscle, movement_pattern, discouraged }) => ({
      id,
      name,
      primary_muscle,
      movement_pattern,
      discouraged,
    }))
}

type LoadedRoutine = {
  id: string
  name: string
  description: string | null
  exercises: Array<{
    exercise_id: string
    name: string
    primary_muscle: string
    secondary_muscles: string[]
    movement_pattern: string | null
    discouraged: boolean
    discouraged_reason: string | null
    target_sets: number
    rep_min: number | null
    rep_max: number | null
    target_rpe: number | null
    rest_sec: number | null
  }>
}

async function loadRoutine(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  routineId: string,
): Promise<LoadedRoutine | null> {
  const { data } = await supabase
    .from('routines')
    .select(
      `id, name, description,
       routine_exercises (
         exercise_id, position, target_sets, rep_min, rep_max, target_rpe, rest_sec,
         exercise:exercise_catalog ( name, primary_muscle, secondary_muscles, movement_pattern, discouraged, discouraged_reason )
       )`,
    )
    .eq('id', routineId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null

  // PostgREST tipizza le relazioni annidate come array anche quando sono
  // to-one: il cast passa da unknown.
  const rows = (data.routine_exercises ?? []) as unknown as Array<{
    exercise_id: string
    position: number
    target_sets: number
    rep_min: number | null
    rep_max: number | null
    target_rpe: number | null
    rest_sec: number | null
    exercise: {
      name: string
      primary_muscle: string
      secondary_muscles: string[]
      movement_pattern: string | null
      discouraged: boolean
      discouraged_reason: string | null
    } | null
  }>

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    exercises: rows
      .filter((r) => r.exercise)
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        exercise_id: r.exercise_id,
        name: r.exercise!.name,
        primary_muscle: r.exercise!.primary_muscle,
        secondary_muscles: r.exercise!.secondary_muscles ?? [],
        movement_pattern: r.exercise!.movement_pattern,
        discouraged: r.exercise!.discouraged,
        discouraged_reason: r.exercise!.discouraged_reason,
        target_sets: r.target_sets,
        rep_min: r.rep_min,
        rep_max: r.rep_max,
        target_rpe: r.target_rpe,
        rest_sec: r.rest_sec,
      })),
  }
}

// --------------------------------------------------------------
// Formattazione e sanitizzazione
// --------------------------------------------------------------

function formatProfile(p: ProfileBrief | null): string {
  if (!p) return 'Profilo utente: non compilato.'
  const bits: string[] = []
  if (p.sex) bits.push(p.sex === 'male' ? 'uomo' : p.sex === 'female' ? 'donna' : 'altro')
  if (p.birth_date) {
    const age = Math.floor(
      (Date.now() - new Date(p.birth_date).getTime()) / 31557600000,
    )
    bits.push(`${age} anni`)
  }
  if (p.weight_kg) bits.push(`${p.weight_kg} kg`)
  if (p.goal_type) bits.push(`fase ${p.goal_type}`)
  if (p.target_kcal) bits.push(`${p.target_kcal} kcal/die`)
  return `Profilo utente: ${bits.join(', ') || 'dati insufficienti'}.`
}

function formatRoutineVolume(routine: LoadedRoutine): string {
  const byMuscle = new Map<string, number>()
  for (const e of routine.exercises) {
    byMuscle.set(
      e.primary_muscle,
      (byMuscle.get(e.primary_muscle) ?? 0) + e.target_sets,
    )
    for (const m of e.secondary_muscles) {
      byMuscle.set(m, (byMuscle.get(m) ?? 0) + e.target_sets * 0.5)
    }
  }
  return (
    [...byMuscle.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m, s]) => `${m} ${s}`)
      .join(' · ') || 'nessun esercizio'
  )
}

type GeneratedProgram = {
  program_name?: string
  goal?: string
  days_per_week?: number
  weeks_planned?: number
  rationale?: string
  routines?: Array<{
    name?: string
    weekday?: number | null
    notes?: string | null
    exercises?: Array<{
      exercise_id?: string
      target_sets?: number
      rep_min?: number | null
      rep_max?: number | null
      target_rpe?: number | null
      rest_sec?: number | null
      superset_group?: number | null
      notes?: string | null
    }>
  }>
}

// Il modello può allucinare un uuid o valori fuori scala: teniamo solo
// esercizi realmente esistenti e limitiamo i numeri ai vincoli dello schema.
function sanitizeProgram(
  p: GeneratedProgram,
  catalog: CatalogEntry[],
): GeneratedProgram | null {
  const valid = new Set(catalog.filter((e) => !e.discouraged).map((e) => e.id))

  const routines = (p.routines ?? [])
    .map((r) => ({
      name: String(r.name ?? 'Seduta').slice(0, 80),
      weekday:
        typeof r.weekday === 'number' && r.weekday >= 0 && r.weekday <= 6
          ? r.weekday
          : null,
      notes: r.notes ? String(r.notes).slice(0, 500) : null,
      exercises: (r.exercises ?? [])
        .filter((e) => e.exercise_id && valid.has(e.exercise_id))
        .map((e) => ({
          exercise_id: e.exercise_id!,
          target_sets: clamp(e.target_sets ?? 3, 1, 20),
          rep_min: e.rep_min != null ? clamp(e.rep_min, 1, 100) : null,
          rep_max: e.rep_max != null ? clamp(e.rep_max, 1, 100) : null,
          target_rpe: e.target_rpe != null ? clamp(e.target_rpe, 1, 10) : null,
          rest_sec: e.rest_sec != null ? clamp(e.rest_sec, 15, 600) : null,
          superset_group:
            e.superset_group != null ? clamp(e.superset_group, 1, 9) : null,
          notes: e.notes ? String(e.notes).slice(0, 300) : null,
        })),
    }))
    .filter((r) => r.exercises.length > 0)

  if (routines.length === 0) return null

  return {
    program_name: String(p.program_name ?? 'Programma').slice(0, 80),
    goal: p.goal,
    days_per_week: p.days_per_week ? clamp(p.days_per_week, 1, 7) : routines.length,
    weeks_planned: p.weeks_planned ? clamp(p.weeks_planned, 1, 52) : null,
    rationale: p.rationale ? String(p.rationale).slice(0, 1500) : undefined,
    routines,
  } as GeneratedProgram
}

function clamp(n: number, lo: number, hi: number): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return lo
  return Math.min(hi, Math.max(lo, v))
}
