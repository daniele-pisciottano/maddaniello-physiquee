import type { ReactNode } from 'react'

const USER = { id: 'preview-user', email: 'preview@local' }

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  return {
    session: { user: USER },
    user: USER,
    loading: false,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
  }
}
