export interface ApiResponse<T> {
  success?: boolean
  isSuccess?: boolean
  data?: T
  value?: T
  result?: T
  items?: T
  message?: string
  errors?: string[]
}

export interface PagedResponse<T> {
  items: T[]
  totalCount?: number
  pageNumber?: number
  pageSize?: number
  totalPages?: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function normalizeKey(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase()
}

function findRawValue(value: unknown, aliases: Set<string>): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRawValue(item, aliases)
      if (found) return found
    }
    return null
  }

  if (!isObject(value)) return null

  for (const [key, rawValue] of Object.entries(value)) {
    if (!aliases.has(normalizeKey(key)) || rawValue == null) continue

    const text = typeof rawValue === 'string' || typeof rawValue === 'number'
      ? String(rawValue).trim()
      : ''
    if (text) return text
  }

  for (const rawValue of Object.values(value)) {
    const found = findRawValue(rawValue, aliases)
    if (found) return found
  }

  return null
}

function parseRawJson(rawDataJson: unknown): unknown {
  if (typeof rawDataJson !== 'string' || !rawDataJson.trim()) return null

  try {
    return JSON.parse(rawDataJson)
  } catch {
    return null
  }
}

function mergeSpotComments(
  current: unknown,
  etd: string | null,
  commodity: string | null,
): string | null {
  const comments: string[] = []
  if (typeof current === 'string' && current.trim()) comments.push(current.trim())

  for (const addition of [etd ? `ETD: ${etd}` : null, commodity ? `Commodity: ${commodity}` : null]) {
    if (!addition) continue
    const normalized = addition.toLocaleLowerCase()
    if (comments.some((comment) => comment.toLocaleLowerCase().includes(normalized))) continue
    comments.push(addition)
  }

  return comments.length ? comments.join(' | ') : null
}

/**
 * Compatibility guard for staggered deployments: Pricing is the source of truth
 * for SPOT validity, while Web makes sure ETD/Commodity are visible in comments
 * even if an older API response did not yet enrich spaceComment.
 */
function normalizeSpotImportRate(value: unknown): unknown {
  if (!isObject(value) || !('rawDataJson' in value)) return value

  const raw = parseRawJson(value.rawDataJson)
  if (!raw) return value

  const rateType = findRawValue(
    raw,
    new Set(['tipotarifa', 'tipodetarifa', 'ratetype', 'tarifftype']),
  )
  if (rateType?.trim().toLocaleUpperCase() !== 'SPOT') return value

  const etd = findRawValue(
    raw,
    new Set(['etd', 'fechaetd', 'estimateddeparture', 'estimatedtimeofdeparture']),
  )
  const currentCommodity =
    typeof value.commodity === 'string' && value.commodity.trim() ? value.commodity.trim() : null
  const commodity = currentCommodity ?? findRawValue(
    raw,
    new Set(['commodity', 'mercancia', 'producto', 'cargo', 'cargotype', 'descripcion', 'description']),
  )

  return {
    ...value,
    commodity: commodity ?? value.commodity,
    spaceComment: mergeSpotComments(value.spaceComment, etd, commodity),
  }
}

export function unwrapApiResponse<T>(response: T | ApiResponse<T>): T {
  let current: unknown = response

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isObject(current)) break

    if ('data' in current && current.data !== undefined) {
      current = current.data
      continue
    }

    if ('value' in current && current.value !== undefined) {
      current = current.value
      continue
    }

    if ('result' in current && current.result !== undefined) {
      current = current.result
      continue
    }

    break
  }

  return normalizeSpotImportRate(current) as T
}

export function unwrapListResponse<T>(response: unknown): T[] {
  const unwrapped = unwrapApiResponse<unknown>(response)

  if (Array.isArray(unwrapped)) return unwrapped.map(normalizeSpotImportRate) as T[]

  if (isObject(unwrapped)) {
    const items = unwrapped.items
    if (Array.isArray(items)) return items.map(normalizeSpotImportRate) as T[]

    const data = unwrapped.data
    if (Array.isArray(data)) return data.map(normalizeSpotImportRate) as T[]

    if (isObject(data) && Array.isArray(data.items)) {
      return data.items.map(normalizeSpotImportRate) as T[]
    }
  }

  return []
}

export function unwrapPagedResponse<T>(response: unknown): PagedResponse<T> {
  const unwrapped = unwrapApiResponse<unknown>(response)

  if (Array.isArray(unwrapped)) {
    const items = unwrapped.map(normalizeSpotImportRate) as T[]
    return { items, totalCount: items.length }
  }

  if (isObject(unwrapped)) {
    const items = Array.isArray(unwrapped.items)
      ? (unwrapped.items.map(normalizeSpotImportRate) as T[])
      : []

    return {
      items,
      totalCount:
        typeof unwrapped.totalCount === 'number'
          ? unwrapped.totalCount
          : typeof unwrapped.total === 'number'
            ? unwrapped.total
            : items.length,
      pageNumber: typeof unwrapped.pageNumber === 'number' ? unwrapped.pageNumber : undefined,
      pageSize: typeof unwrapped.pageSize === 'number' ? unwrapped.pageSize : undefined,
      totalPages: typeof unwrapped.totalPages === 'number' ? unwrapped.totalPages : undefined,
    }
  }

  return { items: [], totalCount: 0 }
}
