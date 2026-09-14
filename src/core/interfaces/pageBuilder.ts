export const CMS_MOTION_PRESETS = [
  'none', 'fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right',
  'slide-up', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'scale', 'blur-in',
] as const

export const CMS_MOTION_EASINGS = ['standard', 'decelerate', 'accelerate', 'linear'] as const
export const CMS_MOTION_TRIGGERS = ['scroll', 'load'] as const

export type CmsMotionPreset = (typeof CMS_MOTION_PRESETS)[number]
export type CmsMotionEasing = (typeof CMS_MOTION_EASINGS)[number]
export type CmsMotionTrigger = (typeof CMS_MOTION_TRIGGERS)[number]

export interface CmsAnimationConfig {
  preset: CmsMotionPreset
  duration: number
  delay: number
  easing: CmsMotionEasing
  stagger: number
  trigger: CmsMotionTrigger
  once: boolean
  distance: number
}

export interface PageBuilderBlock {
  id: string
  type: string
  isVisible: boolean
  data: Record<string, unknown>
  animation?: CmsAnimationConfig
}

export interface PageBuilderDocumentDto {
  contentId: string
  blocksJson: string
}

export interface PageBuilderOperationRequest {
  operation: string
  blockId?: string | null
  blockType?: string | null
  targetIndex?: number | null
  isVisible?: boolean | null
  dataJson?: string | null
  animationJson?: string | null
}
