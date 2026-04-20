// Calcoli macro: kcal da macronutrienti, scaling per grammi.

export const CAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const

export function kcalFromMacros(
  protein_g: number,
  carb_g: number,
  fat_g: number,
): number {
  return (
    protein_g * CAL_PER_G.protein +
    carb_g * CAL_PER_G.carb +
    fat_g * CAL_PER_G.fat
  )
}

// Scala un alimento espresso per 100g a una quantità in grammi.
export function scaleForGrams(
  per100: { kcal: number; protein: number; carb: number; fat: number },
  grams: number,
): { kcal: number; protein: number; carb: number; fat: number } {
  const factor = grams / 100
  return {
    kcal: round1(per100.kcal * factor),
    protein: round1(per100.protein * factor),
    carb: round1(per100.carb * factor),
    fat: round1(per100.fat * factor),
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function round0(n: number): number {
  return Math.round(n)
}

// Suggerisce il meal_type in base all'ora locale.
export function guessMealType(d: Date = new Date()): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = d.getHours()
  if (h >= 5 && h < 11) return 'breakfast'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 18 && h < 23) return 'dinner'
  return 'snack'
}

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Spuntino',
}
