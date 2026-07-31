import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { getSection, type SectionId } from '@/features/tutorial/content'
import { openTutorial } from '@/features/tutorial/useTutorial'
import { RichText } from './RichText'

/**
 * Pulsante "?" da mettere nell'intestazione di una pagina: spiega quella
 * sezione riusando gli stessi testi del tutorial.
 */
export function SectionHelp({ id }: { id: SectionId }) {
  const [open, setOpen] = useState(false)
  const section = getSection(id)
  const Icon = section.icon

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cos'è ${section.label}`}
        title={`Cos'è ${section.label}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              {section.label}
            </DialogTitle>
            <DialogDescription>{section.summary}</DialogDescription>
          </DialogHeader>

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
            onClick={() => {
              setOpen(false)
              openTutorial()
            }}
          >
            Rivedi la guida completa
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
