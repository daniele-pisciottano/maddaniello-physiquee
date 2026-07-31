import { Fragment } from 'react'

// Mini-formattazione per i testi della guida: solo **grassetto** e
// *corsivo*. Bastano questi due, e non serve caricare react-markdown per
// stringhe di una riga.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-medium text-foreground">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </span>
  )
}
