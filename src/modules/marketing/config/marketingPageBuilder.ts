import type { PageBuilderBlock } from '@/core/interfaces/pageBuilder'
import {
  MARKETING_BLOCK_GROUPS,
  type MarketingBlockDefinition,
} from '@/modules/marketing/config/marketingBlockCatalog'

export const MARKETING_BLOCK_DRAG_MIME = 'application/x-dhole-marketing-block'

export const MARKETING_PAGE_BUILDER_TYPES: Record<string, string> = {
  heading: 'RichText',
  text: 'RichText',
  image: 'Image',
  video: 'Video',
  button: 'CTA',
  divider: 'RichText',
  hero: 'Hero',
  columns: 'RichText',
  'image-text': 'RichText',
  gallery: 'Gallery',
  slider: 'Gallery',
  tabs: 'RichText',
  services: 'ServicesGrid',
  team: 'Team',
  clients: 'Logos',
  stats: 'Stats',
  testimonials: 'Testimonials',
  cta: 'CTA',
  banner: 'Banner',
  form: 'Form',
  meeting: 'MeetingForm',
  campaign: 'CTA',
  news: 'NewsGrid',
  faq: 'FAQ',
  'related-posts': 'NewsGrid',
}

const definitions = MARKETING_BLOCK_GROUPS.flatMap((group) => group.blocks)
const definitionsById = new Map(definitions.map((block) => [block.id, block]))

const fallbackBlockByBuilderType: Record<string, string> = {
  hero: 'hero',
  richtext: 'text',
  image: 'image',
  video: 'video',
  gallery: 'gallery',
  cta: 'cta',
  servicesgrid: 'services',
  newsgrid: 'news',
  faq: 'faq',
  testimonials: 'testimonials',
  logos: 'clients',
  stats: 'stats',
  team: 'team',
  banner: 'banner',
  form: 'form',
  meetingform: 'meeting',
}

export function getMarketingBlockDefinition(blockId: string | null | undefined): MarketingBlockDefinition | null {
  if (!blockId) return null
  return definitionsById.get(blockId) ?? null
}

export function getMarketingBuilderType(blockId: string): string | null {
  return MARKETING_PAGE_BUILDER_TYPES[blockId] ?? null
}

export function createMarketingBlockData(blockId: string) {
  return JSON.stringify({ editorBlockKey: blockId })
}

export function getMarketingBlockDefinitionForBuilderBlock(block: PageBuilderBlock): MarketingBlockDefinition | null {
  const editorBlockKey = block.data?.editorBlockKey
  if (typeof editorBlockKey === 'string') {
    const exact = getMarketingBlockDefinition(editorBlockKey)
    if (exact) return exact
  }

  const fallbackId = fallbackBlockByBuilderType[block.type.toLocaleLowerCase('en-US')]
  return getMarketingBlockDefinition(fallbackId)
}

export function parsePageBuilderBlocks(blocksJson: string): PageBuilderBlock[] {
  try {
    const parsed: unknown = JSON.parse(blocksJson)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((candidate): PageBuilderBlock[] => {
      if (!candidate || typeof candidate !== 'object') return []
      const raw = candidate as Record<string, unknown>
      if (typeof raw.id !== 'string' || typeof raw.type !== 'string') return []

      const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? raw.data as Record<string, unknown>
        : {}

      return [{
        id: raw.id,
        type: raw.type,
        isVisible: raw.isVisible !== false,
        data,
        ...(raw.animation && typeof raw.animation === 'object'
          ? { animation: raw.animation as PageBuilderBlock['animation'] }
          : {}),
      }]
    })
  } catch {
    return []
  }
}
