// Tipi condivisi del modulo allenamento (schema 0012/0013).

export type TrackingType =
  | 'weight_reps'
  | 'reps_only'
  | 'weighted_bw'
  | 'duration'
  | 'distance_time'
  | 'weight_duration'

export type SetType =
  | 'normal'
  | 'warmup'
  | 'drop'
  | 'failure'
  | 'backoff'
  | 'amrap'

export type SessionStatus = 'in_progress' | 'completed' | 'discarded'

export type PrType =
  | 'est_1rm'
  | 'max_weight'
  | 'max_reps'
  | 'max_set_volume'
  | 'max_session_volume'

export type Exercise = {
  id: string
  user_id: string | null
  name: string
  aliases: string[]
  primary_muscle: string
  secondary_muscles: string[]
  equipment: string
  movement_pattern: string | null
  plane: string | null
  joint_type: string
  is_unilateral: boolean
  tracking_type: TrackingType
  biomech_notes: string | null
  cues: string[]
  common_errors: Array<{ error: string; cause: string; fix: string }>
  contraindications: string | null
  tier: number
  discouraged: boolean
  discouraged_reason: string | null
  default_rest_sec: number | null
  video_url: string | null
  archived: boolean
}

export type RoutineFolder = {
  id: string
  user_id: string
  name: string
  description: string | null
  goal: string | null
  days_per_week: number | null
  weeks_planned: number | null
  starts_on: string | null
  source: string
  ai_rationale: string | null
  position: number
  archived: boolean
  created_at: string
}

export type Routine = {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  description: string | null
  notes: string | null
  weekday: number | null
  position: number
  source: string
  ai_rationale: string | null
  archived: boolean
  last_performed_at: string | null
  created_at: string
}

export type RoutineSet = {
  id: string
  routine_exercise_id: string
  position: number
  set_type: SetType
  target_reps: number | null
  target_weight_kg: number | null
  target_rpe: number | null
  target_duration_sec: number | null
}

export type RoutineExercise = {
  id: string
  routine_id: string
  exercise_id: string
  position: number
  superset_group: number | null
  target_sets: number
  rep_min: number | null
  rep_max: number | null
  target_rpe: number | null
  rest_sec: number | null
  notes: string | null
  exercise?: Exercise
  routine_sets?: RoutineSet[]
}

export type RoutineWithExercises = Routine & {
  routine_exercises: RoutineExercise[]
}

export type SessionSet = {
  id: string
  session_exercise_id: string
  position: number
  set_type: SetType
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  rir: number | null
  duration_sec: number | null
  distance_m: number | null
  completed: boolean
  is_pr: boolean
  notes: string | null
}

export type SessionExercise = {
  id: string
  session_id: string
  exercise_id: string
  position: number
  superset_group: number | null
  notes: string | null
  exercise?: Exercise
  session_sets: SessionSet[]
}

export type WorkoutSession = {
  id: string
  user_id: string
  routine_id: string | null
  name: string
  status: SessionStatus
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  notes: string | null
  session_rpe: number | null
  total_volume_kg: number
  total_sets: number
  total_reps: number
}

export type SessionWithExercises = WorkoutSession & {
  session_exercises: SessionExercise[]
}

export type PersonalRecord = {
  id: string
  exercise_id: string
  record_type: PrType
  value: number
  weight_kg: number | null
  reps: number | null
  achieved_at: string
}

export type ExerciseHistoryPoint = {
  session_id: string
  performed_at: string
  session_name: string
  best_weight_kg: number | null
  best_reps: number | null
  est_1rm: number | null
  total_volume_kg: number
  work_sets: number
}

export type MuscleVolumeRow = {
  week_start: string
  muscle: string
  sets: number
  volume_kg: number
}

export type LastPerformance = {
  exercise_id: string
  performed_at: string
  sets: Array<{
    position: number
    set_type: SetType
    weight_kg: number | null
    reps: number | null
    rpe: number | null
  }>
}

// Etichette IT --------------------------------------------------

export const MUSCLE_LABELS: Record<string, string> = {
  petto: 'Petto',
  dorso: 'Dorso',
  trapezio: 'Trapezio',
  deltoide_anteriore: 'Deltoide anteriore',
  deltoide_laterale: 'Deltoide laterale',
  deltoide_posteriore: 'Deltoide posteriore',
  bicipiti: 'Bicipiti',
  tricipiti: 'Tricipiti',
  avambracci: 'Avambracci',
  quadricipiti: 'Quadricipiti',
  ischiocrurali: 'Ischiocrurali',
  glutei: 'Glutei',
  adduttori: 'Adduttori',
  abduttori: 'Abduttori',
  polpacci: 'Polpacci',
  erettori_spinali: 'Erettori spinali',
  addome: 'Addome',
  obliqui: 'Obliqui',
  quadrato_lombi: 'Quadrato dei lombi',
  cardio: 'Cardio',
}

export const EQUIPMENT_LABELS: Record<string, string> = {
  bilanciere: 'Bilanciere',
  manubri: 'Manubri',
  cavi: 'Cavi',
  macchina: 'Macchina',
  corpo_libero: 'Corpo libero',
  kettlebell: 'Kettlebell',
  elastico: 'Elastico',
  multipower: 'Multipower',
  altro: 'Altro',
}

export const PATTERN_LABELS: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hip hinge',
  lunge: 'Affondo',
  push_h: 'Spinta orizzontale',
  push_v: 'Spinta verticale',
  pull_h: 'Trazione orizzontale',
  pull_v: 'Trazione verticale',
  carry: 'Trasporto',
  core_anti_ext: 'Core anti-estensione',
  core_flex: 'Core flessione',
  core_anti_lat: 'Core anti-flessione laterale',
  core_anti_rot: 'Core anti-rotazione',
  isolation: 'Isolamento',
  cardio: 'Cardio',
}

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normale',
  warmup: 'Riscaldamento',
  drop: 'Drop set',
  failure: 'A cedimento',
  backoff: 'Back-off',
  amrap: 'AMRAP',
}

// Sigla mostrata nella colonna "serie" del logger
export const SET_TYPE_BADGE: Record<SetType, string> = {
  normal: '',
  warmup: 'R',
  drop: 'D',
  failure: 'C',
  backoff: 'B',
  amrap: 'A',
}

export const PR_TYPE_LABELS: Record<PrType, string> = {
  est_1rm: 'Massimale stimato',
  max_weight: 'Carico massimo',
  max_reps: 'Ripetizioni massime',
  max_set_volume: 'Volume massimo su serie',
  max_session_volume: 'Volume massimo in seduta',
}

// Ordine di visualizzazione dei gruppi muscolari nei grafici volume.
export const MUSCLE_ORDER = [
  'petto',
  'dorso',
  'deltoide_anteriore',
  'deltoide_laterale',
  'deltoide_posteriore',
  'trapezio',
  'bicipiti',
  'tricipiti',
  'avambracci',
  'quadricipiti',
  'ischiocrurali',
  'glutei',
  'adduttori',
  'abduttori',
  'polpacci',
  'erettori_spinali',
  'addome',
  'obliqui',
  'quadrato_lombi',
  'cardio',
]

// Indici 0-6 come il CHECK di `routines.weekday` (0 = lunedì).
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Lunedì',
  1: 'Martedì',
  2: 'Mercoledì',
  3: 'Giovedì',
  4: 'Venerdì',
  5: 'Sabato',
  6: 'Domenica',
}

export function muscleLabel(m: string): string {
  return MUSCLE_LABELS[m] ?? m
}

// Epley — coerente con la formula usata nelle RPC SQL.
export function estimate1rm(weightKg: number, reps: number): number {
  if (!weightKg || !reps) return 0
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export function formatDuration(sec: number | null): string {
  if (!sec || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)} kg`
}
