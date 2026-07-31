// Client Supabase finto per la preview UI locale.
// Ogni catena di query si risolve in un risultato vuoto: i dati veri
// vengono pre-caricati nella cache di react-query (vedi main.tsx).

type Result = { data: unknown; error: null }

const EMPTY: Result = { data: [], error: null }
const EMPTY_ONE: Result = { data: null, error: null }

function makeBuilder(single = false): Record<string, unknown> {
  const builder: Record<string, unknown> = {}
  const chain = [
    'select',
    'eq',
    'neq',
    'is',
    'in',
    'gte',
    'lte',
    'gt',
    'lt',
    'or',
    'order',
    'limit',
    'range',
    'filter',
    'contains',
    'ilike',
  ]
  for (const m of chain) builder[m] = () => builder
  builder.single = () => makeBuilder(true)
  builder.maybeSingle = () => makeBuilder(true)
  builder.then = (resolve: (r: Result) => unknown) =>
    Promise.resolve(resolve(single ? EMPTY_ONE : EMPTY))
  return builder
}

function table() {
  const b = makeBuilder()
  b.insert = () => makeBuilder()
  b.update = () => makeBuilder()
  b.upsert = () => makeBuilder()
  b.delete = () => makeBuilder()
  return b
}

export const isSupabaseConfigured = true

export const supabase = {
  from: () => table(),
  rpc: () => makeBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null } }),
    getUser: async () => ({ data: { user: null } }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
    }),
  },
} as never
