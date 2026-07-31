// Config di sola preview UI: sostituisce Supabase e l'auth con dei mock
// così le schermate si possono ispezionare senza backend.
// Non fa parte della build di produzione.

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Fallback SPA verso preview/index.html: la root resta il progetto, quindi
// senza questo /allenamento non troverebbe nessun html.
function previewSpaFallback(): Plugin {
  return {
    name: 'preview-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const isAsset =
          url.startsWith('/@') ||
          url.startsWith('/node_modules') ||
          url.startsWith('/preview/') ||
          url.startsWith('/src/') ||
          /\.[a-z0-9]+$/i.test(url)
        if (!isAsset) req.url = '/preview/index.html'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), previewSpaFallback()],
  // La root resta quella del progetto: con root su preview/ i file di src
  // finivano fuori dallo scope di optimizeDeps e l'app caricava due copie
  // di React ("Invalid hook call").
  resolve: {
    alias: [
      {
        find: '@/lib/supabase',
        replacement: path.resolve(__dirname, 'preview/mock-supabase.ts'),
      },
      {
        find: '@/features/auth/AuthProvider',
        replacement: path.resolve(__dirname, 'preview/mock-auth.tsx'),
      },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5199 },
})
