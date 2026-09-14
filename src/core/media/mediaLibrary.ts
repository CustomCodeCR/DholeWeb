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
  if (kind === 'document') return 'document'
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
  sizeInBytes?: number | null
  variants?: Array<{
    key?: string
    fileName?: string
    contentType?: string
    path?: string
    sizeInBytes?: number
  }>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return null
}

function parseNestedJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

function metadataCandidates(root: Record<string, unknown>) {
  const file = asRecord(root.file)
  const data = asRecord(root.data)
  const marketingMedia = asRecord(root.marketingMedia)
  const fileMarketingMedia = file ? asRecord(file.marketingMedia) : null
  const fileMetadata = file
    ? asRecord(file.metadata) ?? parseNestedJson(file.metadataJson)
    : null
  const dataMetadata = data
    ? asRecord(data.metadata) ?? parseNestedJson(data.metadataJson)
    : null

  return [fileMarketingMedia, marketingMedia, fileMetadata, dataMetadata, file, data, root]
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate))
}

function readFirstNumber(candidates: Record<string, unknown>[], keys: string[]) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = finiteNumber(candidate[key])
      if (value != null) return value
    }
  }
  return null
}

function readFirstString(candidates: Record<string, unknown>[], keys: string[]) {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key]
      if (typeof value === 'string' && value.trim()) return value
    }
  }
  return null
}

function readVariants(candidates: Record<string, unknown>[]) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate.variants)) {
      return candidate.variants.filter((variant): variant is MarketingMediaMetadata['variants'][number] => Boolean(asRecord(variant)))
        .map((variant) => variant as MarketingMediaMetadata['variants'][number])
    }
  }
  return undefined
}

export function parseMarketingMediaMetadata(metadataJson?: string | null): MarketingMediaMetadata | null {
  if (!metadataJson?.trim()) return null

  try {
    const root = asRecord(JSON.parse(metadataJson))
    if (!root) return null
    const candidates = metadataCandidates(root)
    const variants = readVariants(candidates)
    const metadata: MarketingMediaMetadata = {
      category: readFirstString(candidates, ['category']) ?? undefined,
      format: readFirstString(candidates, ['format', 'extension']) ?? undefined,
      width: readFirstNumber(candidates, ['width']) ?? undefined,
      height: readFirstNumber(candidates, ['height']) ?? undefined,
      durationSeconds: readFirstNumber(candidates, ['durationSeconds', 'duration']) ?? undefined,
      sizeInBytes: readFirstNumber(candidates, ['sizeInBytes', 'fileSizeInBytes', 'fileSize', 'size', 'length']) ?? undefined,
      ...(variants ? { variants } : {}),
    }

    if (
      metadata.category === undefined
      && metadata.format === undefined
      && metadata.width === undefined
      && metadata.height === undefined
      && metadata.durationSeconds === undefined
      && metadata.sizeInBytes === undefined
      && metadata.variants === undefined
    ) return null

    return metadata
  } catch {
    return null
  }
}

export function mediaSizeInBytes(metadataJson?: string | null) {
  const parsed = parseMarketingMediaMetadata(metadataJson)
  if (parsed?.sizeInBytes != null) return parsed.sizeInBytes

  const variantSizes = parsed?.variants
    ?.map((variant) => finiteNumber(variant.sizeInBytes))
    .filter((value): value is number => value != null) ?? []

  return variantSizes.length ? Math.max(...variantSizes) : null
}

export function formatMediaFileSize(sizeInBytes?: number | null) {
  if (sizeInBytes == null || !Number.isFinite(sizeInBytes) || sizeInBytes < 0) return '—'
  if (sizeInBytes < 1024) return `${Math.round(sizeInBytes)} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = sizeInBytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${Number(value.toFixed(decimals))} ${units[unitIndex]}`
}
