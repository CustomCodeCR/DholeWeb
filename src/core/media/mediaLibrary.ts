export type MarketingMediaKind = 'all' | 'image' | 'video' | 'pdf' | 'document'

export const MARKETING_MEDIA_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.mp4',
  '.webm',
  '.mov',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.csv',
  '.txt',
].join(',')

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif'])
const videoExtensions = new Set(['mp4', 'webm', 'mov'])
const documentExtensions = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt'])

function extension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? ''
}

export function mediaKind(contentType: string | null | undefined, fileName = ''): Exclude<MarketingMediaKind, 'all'> {
  const type = (contentType ?? '').trim().toLowerCase()
  const ext = extension(fileName)

  if (type.startsWith('image/') || imageExtensions.has(ext)) return 'image'
  if (type.startsWith('video/') || videoExtensions.has(ext)) return 'video'
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  return 'document'
}

export function mediaContentTypeFilter(kind: MarketingMediaKind): string | undefined {
  if (kind === 'image') return 'image/'
  if (kind === 'video') return 'video/'
  if (kind === 'pdf') return 'application/pdf'
  return undefined
}

export function isAllowedMarketingFile(file: { name: string; type?: string | null }) {
  const ext = extension(file.name)
  return imageExtensions.has(ext)
    || videoExtensions.has(ext)
    || ext === 'pdf'
    || documentExtensions.has(ext)
}

export interface MarketingMediaMetadata {
  category?: string
  format?: string | null
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  variants?: Array<{
    key?: string
    fileName?: string
    contentType?: string
    path?: string
    sizeInBytes?: number
  }>
}

export function parseMarketingMediaMetadata(metadataJson?: string | null): MarketingMediaMetadata | null {
  if (!metadataJson?.trim()) return null

  try {
    const value = JSON.parse(metadataJson) as Record<string, unknown>
    const nested = value.marketingMedia
    if (nested && typeof nested === 'object') return nested as MarketingMediaMetadata

    if ('category' in value || 'variants' in value || 'durationSeconds' in value) {
      return value as MarketingMediaMetadata
    }

    return null
  } catch {
    return null
  }
}
