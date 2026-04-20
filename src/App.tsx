import { Routes, Route, Navigate } from 'react-router-dom'
import { SignIn } from './routes/auth/SignIn'
import { SignUp } from './routes/auth/SignUp'
import { Home } from './routes/Home'
import { Meals } from './routes/Meals'
import { Recipes } from './routes/Recipes'
import { Settings } from './routes/Settings'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'

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
        <Route path="/" element={<Home />} />
        <Route path="/meals" element={<Meals />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
