import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { App } from '@/App'
import { AuthProvider } from '@/features/auth/AuthProvider'
import '@/index.css'
import * as F from './fixtures'

const U = 'preview-user'

// staleTime infinito: con la cache pre-caricata i queryFn non partono mai
// e il client Supabase finto non viene mai davvero interrogato.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false },
  },
})

const seed: Array<[unknown[], unknown]> = [
  [['exercise-catalog', U], F.EXERCISES],
  [['routine-folders', U], F.FOLDERS],
  [['routines', U], F.ROUTINES],
  [['routine', 'r1'], F.ROUTINE_DEEP],
  [['sessions', U, 50], F.SESSIONS],
  [['sessions', U, 30], F.SESSIONS],
  [['active-session', U], F.ACTIVE_SESSION],
  [['training-summary', U, 4], F.TRAINING_SUMMARY],
  [['muscle-volume', U, 8], F.MUSCLE_VOLUME],
  [['weekly-volume', U, 8], F.WEEKLY_VOLUME],
  [['personal-records', U, 'all'], F.PERSONAL_RECORDS],
  [['personal-records', U, 'e1'], F.PERSONAL_RECORDS.slice(0, 1)],
  [['exercise-history', U, 'e1', 30], F.EXERCISE_HISTORY],
  [
    ['last-performance', U, [...F.LAST_PERFORMANCE.keys()].sort().join(',')],
    F.LAST_PERFORMANCE,
  ],
]
for (const [key, data] of seed) queryClient.setQueryData(key, data)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
