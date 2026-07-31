import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile } from '@/features/profile/useProfile'
import { useMeasurements } from '@/features/measurements/useMeasurements'
import { useAiSettings } from '@/features/ai/useAiSettings'
import { useAiCredentials } from '@/features/ai/useAiCredentials'

// Lo stato "già visto" sta in localStorage e non nel database: è una
// preferenza di interfaccia, non un dato dell'utente, e così su un nuovo
// dispositivo il tour riparte — che è il comportamento utile.
const STORAGE_KEY = 'tutorial-completed-v1'

// Evento custom: permette a qualsiasi punto dell'app di aprire il tour
// senza dover far passare una callback attraverso mezzo albero React.
const OPEN_EVENT = 'tutorial:open'

export function openTutorial() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true // storage bloccato: meglio non insistere col tour
  }
}

export function useTutorialController() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasSeenTutorial()) setOpen(true)
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, handler)
    return () => window.removeEventListener(OPEN_EVENT, handler)
  }, [])

  // Chiudere il tour lo marca come visto, sia che venga completato sia
  // che venga saltato: in entrambi i casi non deve ricomparire da solo.
  const close = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* storage non disponibile: pazienza */
    }
    setOpen(false)
  }, [])

  return { open, close }
}

export type SetupStep = {
  id: string
  label: string
  hint: string
  path: string
  done: boolean
}

/**
 * Stato reale della configurazione iniziale. Serve al tutorial per
 * mostrare cosa manca davvero invece di una lista generica.
 */
export function useSetupChecklist() {
  const { data: profile, isLoading: pLoading } = useProfile()
  const { data: measurements = [], isLoading: mLoading } = useMeasurements()
  const { data: aiSettings, isLoading: sLoading } = useAiSettings()
  const { data: credentials = [], isLoading: cLoading } = useAiCredentials()

  const steps = useMemo<SetupStep[]>(() => {
    const hasProfile = Boolean(
      profile?.sex && profile?.birth_date && profile?.height_cm,
    )
    const hasGoal = Boolean(profile?.goal_type)
    const hasTargets = Boolean(profile?.target_kcal)
    const hasMeasurement = measurements.length > 0
    const activeProvider = aiSettings?.active_provider ?? null
    const hasAi = Boolean(
      activeProvider &&
        credentials.some(
          (c) => c.provider === activeProvider && c.default_model,
        ),
    )

    return [
      {
        id: 'profile',
        label: 'Profilo',
        hint: 'Sesso, data di nascita, altezza e livello di attività.',
        path: '/assessment',
        done: hasProfile,
      },
      {
        id: 'goal',
        label: 'Obiettivo',
        hint: 'Definizione, massa, ricomposizione o mantenimento.',
        path: '/assessment',
        done: hasGoal,
      },
      {
        id: 'measurement',
        label: 'Prima misura',
        hint: 'Peso di partenza: senza non si può calcolare nulla.',
        path: '/assessment',
        done: hasMeasurement,
      },
      {
        id: 'targets',
        label: 'Target giornalieri',
        hint: 'Calorie e macro. L’app li calcola, tu li correggi.',
        path: '/settings',
        done: hasTargets,
      },
      {
        id: 'ai',
        label: 'Provider AI',
        hint: 'Chiave API e modello: senza, chat e coach non funzionano.',
        path: '/settings',
        done: hasAi,
      },
    ]
  }, [profile, measurements, aiSettings, credentials])

  const isLoading = pLoading || mLoading || sLoading || cLoading
  const doneCount = steps.filter((s) => s.done).length

  return { steps, isLoading, doneCount, total: steps.length }
}
