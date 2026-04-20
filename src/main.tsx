import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { ConfigError } from './components/ConfigError'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (!isSupabaseConfigured) {
  root.render(
    <React.StrictMode>
      <ConfigError />
    </React.StrictMode>,
  )
} else {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}
