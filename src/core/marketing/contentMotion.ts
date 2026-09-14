import {
  CMS_MOTION_EASINGS,
  CMS_MOTION_PRESETS,
  CMS_MOTION_TRIGGERS,
  type CmsAnimationConfig,
  type CmsMotionEasing,
  type CmsMotionPreset,
  type CmsMotionTrigger,
  type PageBuilderBlock,
} from '@/core/interfaces/pageBuilder'

export const DEFAULT_CMS_ANIMATION: CmsAnimationConfig = {
  preset: 'none',
  duration: 600,
  delay: 0,
  easing: 'standard',
  stagger: 100,
  trigger: 'scroll',
  once: true,
  distance: 32,
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number])
}

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback
}

export function normalizeCmsAnimation(input?: Partial<CmsAnimationConfig> | null): CmsAnimationConfig {
  return {
    preset: isOneOf(CMS_MOTION_PRESETS, input?.preset) ? input.preset as CmsMotionPreset : DEFAULT_CMS_ANIMATION.preset,
    duration: bounded(input?.duration, DEFAULT_CMS_ANIMATION.duration, 0, 3000),
    delay: bounded(input?.delay, DEFAULT_CMS_ANIMATION.delay, 0, 3000),
    easing: isOneOf(CMS_MOTION_EASINGS, input?.easing) ? input.easing as CmsMotionEasing : DEFAULT_CMS_ANIMATION.easing,
    stagger: bounded(input?.stagger, DEFAULT_CMS_ANIMATION.stagger, 0, 1000),
    trigger: isOneOf(CMS_MOTION_TRIGGERS, input?.trigger) ? input.trigger as CmsMotionTrigger : DEFAULT_CMS_ANIMATION.trigger,
    once: typeof input?.once === 'boolean' ? input.once : DEFAULT_CMS_ANIMATION.once,
    distance: bounded(input?.distance, DEFAULT_CMS_ANIMATION.distance, 0, 160),
  }
}

export function validateCmsAnimation(input: CmsAnimationConfig): string | null {
  if (!CMS_MOTION_PRESETS.includes(input.preset)) return 'Seleccione un preset de animación válido.'
  if (!CMS_MOTION_EASINGS.includes(input.easing)) return 'Seleccione un easing válido.'
  if (!CMS_MOTION_TRIGGERS.includes(input.trigger)) return 'Seleccione un trigger válido.'
  for (const [label, value, min, max] of [
    ['Duración', input.duration, 0, 3000],
    ['Delay', input.delay, 0, 3000],
    ['Stagger', input.stagger, 0, 1000],
    ['Distancia', input.distance, 0, 160],
  ] as const) {
    if (!Number.isInteger(value) || value < min || value > max) return `${label} debe estar entre ${min} y ${max}.`
  }
  return null
}

export function parsePageBuilderBlocks(blocksJson: string): PageBuilderBlock[] {
  let parsed: unknown
  try { parsed = JSON.parse(blocksJson || '[]') } catch { return [] }
  if (!Array.isArray(parsed)) return []

  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const block = entry as Record<string, unknown>
    if (typeof block.id !== 'string' || typeof block.type !== 'string') return []
    const rawAnimation = block.animation && typeof block.animation === 'object' && !Array.isArray(block.animation)
      ? block.animation as Partial<CmsAnimationConfig>
      : undefined
    return [{
      id: block.id,
      type: block.type,
      isVisible: block.isVisible !== false,
      data: block.data && typeof block.data === 'object' && !Array.isArray(block.data)
        ? block.data as Record<string, unknown>
        : {},
      animation: normalizeCmsAnimation(rawAnimation),
    }]
  })
}
