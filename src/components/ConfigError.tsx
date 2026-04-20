export function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-destructive">
            Config error
          </p>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            Variabili di ambiente mancanti
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            L'app non trova <code className="font-mono text-primary">VITE_SUPABASE_URL</code>{' '}
            e/o <code className="font-mono text-primary">VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 text-sm">
          <p className="font-semibold">In locale</p>
          <p className="mt-1 text-muted-foreground">
            Copia <code className="font-mono">.env.example</code> in{' '}
            <code className="font-mono">.env.local</code> e compila i valori da
            Supabase → Settings → API.
          </p>
          <p className="mt-4 font-semibold">Su Netlify</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Site configuration → Environment variables → aggiungi entrambe con
              valori reali
            </li>
            <li>
              Deploys → <b>Trigger deploy</b> → <b>Clear cache and deploy site</b>
            </li>
            <li>
              Dopo il deploy: DevTools → Application → Service Workers →{' '}
              <b>Unregister</b>, poi hard refresh (Cmd+Shift+R)
            </li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          Le variabili vengono inlinate al momento del <b>build</b>, non a
          runtime. Se le aggiungi dopo aver deployato, devi rebuildare con cache
          pulita.
        </p>
      </div>
    </div>
  )
}
