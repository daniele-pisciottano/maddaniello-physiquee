import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  TUTORIAL_STEPS,
  getSection,
  type TutorialStep,
} from '@/features/tutorial/content'
import { useSetupChecklist } from '@/features/tutorial/useTutorial'
import { RichText } from './RichText'

type Props = {
  open: boolean
  onClose: () => void
}

export function TutorialDialog({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  // Riapertura dal menu: si riparte dall'inizio invece di riprendere da
  // dove era rimasto la volta scorsa.
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  // Clamp difensivo: due tap rapidi su "Avanti" vengono accorpati da
  // React nello stesso render e farebbero uscire l'indice dall'array.
  const safeIndex = Math.min(Math.max(index, 0), TUTORIAL_STEPS.length - 1)
  const step = TUTORIAL_STEPS[safeIndex]
  const isLast = safeIndex === TUTORIAL_STEPS.length - 1

  function goTo(path: string) {
    onClose()
    navigate(path)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:p-0">
        <DialogHeader className="shrink-0 p-4 pb-3 pr-10 sm:p-6 sm:pb-3">
          <StepHeader step={step} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
          <StepBody step={step} onNavigate={goTo} />
        </div>

        <div
          className="shrink-0 border-t border-border p-4 sm:p-6"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mb-3 flex items-center justify-center gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === safeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={safeIndex === 0}
            >
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto h-11 text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              {isLast ? 'Chiudi' : 'Salta'}
            </Button>
            {!isLast && (
              <Button
                type="button"
                className="h-11"
                onClick={() =>
                  setIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))
                }
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {isLast && (
              <Button type="button" className="h-11" onClick={onClose}>
                <Check className="h-4 w-4" />
                Inizia
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StepHeader({ step }: { step: TutorialStep }) {
  if (step.kind === 'intro') {
    return (
      <>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Benvenuto
        </DialogTitle>
        <DialogDescription>
          Due minuti per capire come è fatta l’app e cosa configurare per prima
          cosa.
        </DialogDescription>
      </>
    )
  }
  if (step.kind === 'setup') {
    return (
      <>
        <DialogTitle>Configurazione iniziale</DialogTitle>
        <DialogDescription>
          Questi cinque passaggi servono perché il resto abbia senso.
        </DialogDescription>
      </>
    )
  }
  if (step.kind === 'outro') {
    return (
      <>
        <DialogTitle>Tutto qui</DialogTitle>
        <DialogDescription>
          Puoi rivedere questa guida quando vuoi.
        </DialogDescription>
      </>
    )
  }

  const section = getSection(step.id)
  const Icon = section.icon
  return (
    <>
      <DialogTitle className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        {section.label}
      </DialogTitle>
      <DialogDescription>{section.summary}</DialogDescription>
    </>
  )
}

function StepBody({
  step,
  onNavigate,
}: {
  step: TutorialStep
  onNavigate: (path: string) => void
}) {
  if (step.kind === 'intro') return <IntroBody />
  if (step.kind === 'setup') return <SetupBody onNavigate={onNavigate} />
  if (step.kind === 'outro') return <OutroBody />

  const section = getSection(step.id)
  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {section.bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <RichText text={b} />
          </li>
        ))}
      </ul>
      {section.tip && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed">
          <span className="font-medium text-primary">Da sapere: </span>
          <RichText text={section.tip} />
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={() => onNavigate(section.path)}
      >
        Vai a {section.label}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function IntroBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>
        Questa app tiene insieme tre cose che di solito stanno in tre posti
        diversi: <strong>cosa mangi</strong>, <strong>come ti alleni</strong> e{' '}
        <strong>come cambia il tuo corpo</strong>.
      </p>
      <p>
        La differenza rispetto a un normale diario è che i dati non restano
        fermi lì: un coach AI li legge tutti insieme e ragiona secondo due
        riferimenti precisi — <em>Project Nutrition</em> di Andrea Biasci per la
        nutrizione e <em>Project Exercise</em> di Andrea Roncari per la
        biomeccanica e la programmazione.
      </p>
      <p className="rounded-md border border-border bg-card/50 p-3 text-muted-foreground">
        Il principio di fondo dei due libri è lo stesso:{' '}
        <span className="text-foreground">
          senza dati sono tutti atti di fede
        </span>
        . Più tracci con onestà, più i consigli diventano tuoi e non generici.
      </p>
    </div>
  )
}

function SetupBody({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { steps, isLoading, doneCount, total } = useSetupChecklist()

  return (
    <div className="space-y-3">
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {doneCount === total
            ? 'Configurazione completa: puoi usare tutto.'
            : `Completati ${doneCount} di ${total}.`}
        </p>
      )}
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onNavigate(s.path)}
              className={cn(
                'flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors',
                s.done
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border hover:bg-secondary',
              )}
            >
              {s.done ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-sm font-medium',
                    s.done && 'text-muted-foreground line-through',
                  )}
                >
                  {s.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {s.hint}
                </span>
              </span>
              {!s.done && (
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        L’assessment iniziale copre i primi tre in un flusso guidato.
      </p>
    </div>
  )
}

function OutroBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Da dove partire, in ordine:</p>
      <ol className="space-y-2">
        {[
          'Completa la configurazione iniziale, se manca qualcosa.',
          'Logga i pasti per una settimana intera, anche i giorni storti: servono a capire il punto di partenza.',
          'Costruisci la prima scheda, o falla generare al coach AI descrivendo giorni e obiettivo.',
          'Pesati con regolarità, sempre nelle stesse condizioni.',
          'Dopo due settimane genera la prima review.',
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] text-primary">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <p className="rounded-md border border-border bg-card/50 p-3 text-muted-foreground">
        Per rivedere questa guida: <strong className="text-foreground">Impostazioni → Guida all’uso</strong>. Il pulsante{' '}
        <strong className="text-foreground">?</strong> accanto al titolo di ogni
        pagina spiega invece quella singola sezione.
      </p>
    </div>
  )
}
