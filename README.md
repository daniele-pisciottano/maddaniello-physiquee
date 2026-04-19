# Maddaniello's Physique

Companion nutrizionale AI personale — PWA web-only.

**Stack**: React 18 + Vite + TypeScript · Tailwind · Supabase (Auth/Postgres/pgvector) · Netlify Functions · OpenAI/Gemini (user-provided keys).

---

## Quick start locale

### 1. Dipendenze
```bash
npm install
```

### 2. Env vars
```bash
cp .env.example .env.local
```
Poi apri `.env.local` e inserisci dal progetto Supabase (Settings → API):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Applica lo schema DB
1. Apri Supabase → **SQL Editor** → **New query**
2. Incolla il contenuto di [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql)
3. **Run**

### 4. Config Supabase Auth
- Supabase → **Authentication → Providers → Email**: abilita "Email" provider
- (Opzionale per dev) Authentication → Email Templates: puoi disabilitare "Confirm email" per registrazioni immediate durante lo sviluppo

### 5. Avvia
```bash
npm run dev
```
Apri http://localhost:5173 → ti reindirizza a `/auth/signin`. Clicca "Registrati" e crea il primo account.

---

## Deploy Netlify

### Prima volta
1. Push del repo su GitHub
2. Netlify → **Add new site** → **Import an existing project** → scegli il repo
3. Build settings (dovrebbero essere già auto-rilevati da `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. **Environment variables** (Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - *(aggiunti in fasi successive)* `SUPABASE_SERVICE_ROLE_KEY`, `MASTER_ENCRYPTION_KEY`
5. Deploy

### Auth redirect URL in Supabase
In Supabase → Authentication → URL Configuration, aggiungi:
- Site URL: `https://<tuo-sito>.netlify.app`
- Redirect URLs: `https://<tuo-sito>.netlify.app/**`

---

## Struttura

```
maddaniello-physique/
├── public/                    # asset statici (favicon, icone PWA)
├── src/
│   ├── components/
│   │   ├── layout/            # AppShell, Sidebar, Topbar, BottomNav
│   │   └── ui/                # Button, Input, Label (shadcn-style)
│   ├── features/
│   │   └── auth/              # AuthProvider, useAuth
│   ├── lib/
│   │   ├── supabase.ts        # client Supabase
│   │   ├── queryClient.ts     # React Query config
│   │   └── utils.ts           # cn() helper
│   ├── routes/
│   │   ├── auth/              # SignIn, SignUp
│   │   ├── Home.tsx
│   │   └── ProtectedRoute.tsx
│   ├── App.tsx                # routing
│   ├── main.tsx               # entry
│   └── index.css              # Tailwind + CSS variables (dark sporty)
├── netlify/functions/         # API serverless (AI proxy in fasi successive)
├── supabase/migrations/       # schema SQL versionato
├── netlify.toml
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Roadmap fasi

| Fase | Stato | Contenuto |
|---|---|---|
| **0. Setup** | ✅ | Auth, layout, routing, PWA, design system |
| 1. Profilo & misure | ⏳ | CRUD profile, measurements, grafico peso, export JSON |
| 2. Food DB & log manuale | ⏳ | Open Food Facts, barcode scanner, custom foods, ricette |
| 3. Dashboard oggi | ⏳ | Anello kcal, barre macro, quick-add |
| 4. Impostazioni AI | ⏳ | API key cifrate (AES-256-GCM), scelta provider/modello, budget cap |
| 5. Log via chat AI | ⏳ | Parsing pasto via LLM, feedback loop, learned_corrections |
| 6. Companion chat | ⏳ | Context-aware (giorno/settimana/regole), prompt caching |
| 7. Knowledge base RAG | ⏳ | pgvector, embedding, chunk retrieval |
| 8. Training/sleep/integratori | ⏳ | Tracking complementare |
| 9. Fasi & review bisettimanale | ⏳ | Banner auto-review, applica suggerimenti |
| 10. Assessment iniziale + reset | ⏳ | Wizard, export/import, ricomincia |
| 11. Polish | ⏳ | Animazioni, offline queue, install prompt |

---

## Principi di progetto

- **Costi AI minimi**: modelli mini di default, prompt caching, DB-first/AI-fallback, cache interpretazioni, aggregati in SQL.
- **Privacy**: RLS attiva su tutto. API key AI cifrate a riposo in DB. Nessun tracking esterno.
- **Dark-first**: dark mode sempre attiva (no light mode toggle per ora).
- **Italiano**: tutta la UI.
- **PWA**: installabile mobile + desktop, no store.
