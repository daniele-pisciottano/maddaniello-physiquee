// Selezione dei blocchi di knowledge base da iniettare nel system prompt.
//
// Iniettare l'intera dottrina a ogni messaggio costerebbe ~4k token di
// input per turno. Qui selezioniamo per argomento: i due blocchi "core"
// sono sempre presenti (sono la spina dorsale del ragionamento), gli
// approfondimenti solo quando la conversazione li tocca.

import { NUTRITION_BLOCKS, NUTRITION_CORE, type KbBlock } from './nutrition'
import { TRAINING_BLOCKS, TRAINING_CORE } from './biomechanics'

export { NUTRITION_CORE, TRAINING_CORE }
export type { KbBlock }

const ALL_BLOCKS: KbBlock[] = [...NUTRITION_BLOCKS, ...TRAINING_BLOCKS]

const MAX_BLOCKS = 4

export type KbSelection = {
  text: string
  blockIds: string[]
}

/**
 * Costruisce il blocco "Principi guida" per il system prompt.
 *
 * @param queryText   messaggio dell'utente (per la selezione tematica)
 * @param opts.includeTraining  forza l'inclusione del core allenamento
 *                              (es. nel coach allenamento o quando
 *                              l'utente ha sessioni recenti)
 */
export function selectKnowledge(
  queryText: string,
  opts?: { includeTraining?: boolean; maxBlocks?: number },
): KbSelection {
  const q = normalize(queryText)
  const max = opts?.maxBlocks ?? MAX_BLOCKS

  const scored: Array<{ block: KbBlock; score: number }> = []
  for (const block of ALL_BLOCKS) {
    let score = 0
    for (const trigger of block.triggers) {
      if (q.includes(normalize(trigger))) {
        // I trigger più lunghi sono più specifici e pesano di più.
        score += trigger.length >= 8 ? 3 : 1
      }
    }
    if (score > 0) scored.push({ block, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, max).map((s) => s.block)

  const isTrainingBlock = (id: string) =>
    TRAINING_BLOCKS.some((b) => b.id === id)
  const trainingTouched =
    opts?.includeTraining || picked.some((b) => isTrainingBlock(b.id))

  const parts: string[] = [NUTRITION_CORE]
  if (trainingTouched) parts.push(TRAINING_CORE)
  for (const b of picked) parts.push(b.content)

  return {
    text: parts.join('\n\n'),
    blockIds: picked.map((b) => b.id),
  }
}

// Rimuove accenti e normalizza per un match tollerante
// ("perche" trova "perché", "allenamento" trova "Allenamento").
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
