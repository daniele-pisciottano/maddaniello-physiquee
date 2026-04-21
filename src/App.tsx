import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { SignIn } from './routes/auth/SignIn'
import { SignUp } from './routes/auth/SignUp'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'

// Lazy-load delle route: ogni pagina in un chunk separato.
const Home = lazy(() =>
  import('./routes/Home').then((m) => ({ default: m.Home })),
)
const Meals = lazy(() =>
  import('./routes/Meals').then((m) => ({ default: m.Meals })),
)
const Recipes = lazy(() =>
  import('./routes/Recipes').then((m) => ({ default: m.Recipes })),
)
const Chat = lazy(() =>
  import('./routes/Chat').then((m) => ({ default: m.Chat })),
)
const Reviews = lazy(() =>
  import('./routes/Reviews').then((m) => ({ default: m.Reviews })),
)
const Training = lazy(() =>
  import('./routes/Training').then((m) => ({ default: m.Training })),
)
const Assessment = lazy(() =>
  import('./routes/Assessment').then((m) => ({ default: m.Assessment })),
)
const Settings = lazy(() =>
  import('./routes/Settings').then((m) => ({ default: m.Settings })),
)

function RouteFallback() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

export function App() {
  return (
    <Routes>
      <Route path="/auth/signin" element={<SignIn />} />
      <Route path="/auth/signup" element={<SignUp />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Lazy><Home /></Lazy>} />
        <Route path="/meals" element={<Lazy><Meals /></Lazy>} />
        <Route path="/recipes" element={<Lazy><Recipes /></Lazy>} />
        <Route path="/chat" element={<Lazy><Chat /></Lazy>} />
        <Route path="/reviews" element={<Lazy><Reviews /></Lazy>} />
        <Route path="/training" element={<Lazy><Training /></Lazy>} />
        <Route path="/assessment" element={<Lazy><Assessment /></Lazy>} />
        <Route path="/settings" element={<Lazy><Settings /></Lazy>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
