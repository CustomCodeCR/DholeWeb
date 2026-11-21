/** Typed visual accessory catalog shared by settings, local preferences and SVG renderer. */
export const MASCOT_ACCESSORIES = [
  'none', 'cap', 'crown', 'glasses', 'headphones', 'bow', 'hat',
  'jester', 'monocle', 'party',
  'santa', 'reindeer', 'scarf', 'candyCane', 'lights',
  'witch', 'pumpkin', 'vampire', 'bat', 'ghost',
  'patrioticBand', 'patrioticBow', 'patrioticFlag', 'patrioticFlower',
] as const

export type MascotAccessory = (typeof MASCOT_ACCESSORIES)[number]
export type MascotAccessoryCategory = 'basic' | 'christmas' | 'halloween' | 'patriotic' | 'fun'
export type MascotAccessorySlot = 'head' | 'eyes' | 'ears' | 'neck' | 'side' | 'back' | 'mouth' | 'accent'

export const MASCOT_ACCESSORY_CATEGORIES: readonly MascotAccessoryCategory[] = [
  'basic', 'christmas', 'halloween', 'patriotic', 'fun',
]

export const MASCOT_ACCESSORY_CATEGORY: Record<Exclude<MascotAccessory, 'none'>, MascotAccessoryCategory> = {
  cap: 'basic', crown: 'basic', glasses: 'basic', headphones: 'basic', bow: 'basic', hat: 'basic',
  jester: 'fun', monocle: 'fun', party: 'fun',
  santa: 'christmas', reindeer: 'christmas', scarf: 'christmas', candyCane: 'christmas', lights: 'christmas',
  witch: 'halloween', pumpkin: 'halloween', vampire: 'halloween', bat: 'halloween', ghost: 'halloween',
  patrioticBand: 'patriotic', patrioticBow: 'patriotic', patrioticFlag: 'patriotic', patrioticFlower: 'patriotic',
}

export const MASCOT_ACCESSORY_SLOT: Record<Exclude<MascotAccessory, 'none'>, MascotAccessorySlot> = {
  cap: 'head', crown: 'head', glasses: 'eyes', headphones: 'ears', bow: 'neck', hat: 'head',
  jester: 'head', monocle: 'eyes', party: 'head',
  santa: 'head', reindeer: 'head', scarf: 'neck', candyCane: 'side', lights: 'back',
  witch: 'head', pumpkin: 'head', vampire: 'mouth', bat: 'back', ghost: 'back',
  patrioticBand: 'head', patrioticBow: 'neck', patrioticFlag: 'side', patrioticFlower: 'accent',
}

/** Exclusive slots prevent overlapping hats and glasses; independent slots may be combined. */
export function normalizeMascotAccessories(values: readonly unknown[]): Exclude<MascotAccessory, 'none'>[] {
  const selected = new Map<MascotAccessorySlot, Exclude<MascotAccessory, 'none'>>()
  for (const value of values) {
    if (typeof value !== 'string' || value === 'none' || !MASCOT_ACCESSORIES.includes(value as MascotAccessory)) continue
    const kind = value as Exclude<MascotAccessory, 'none'>
    selected.set(MASCOT_ACCESSORY_SLOT[kind], kind)
  }
  return [...selected.values()]
}
