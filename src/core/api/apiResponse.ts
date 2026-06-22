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

  return current as T
}

export function unwrapListResponse<T>(response: unknown): T[] {
  const unwrapped = unwrapApiResponse<unknown>(response)

  if (Array.isArray(unwrapped)) return unwrapped as T[]

  if (isObject(unwrapped)) {
    const items = unwrapped.items
    if (Array.isArray(items)) return items as T[]

    const data = unwrapped.data
    if (Array.isArray(data)) return data as T[]

    if (isObject(data) && Array.isArray(data.items)) return data.items as T[]
  }

  return []
}

export function unwrapPagedResponse<T>(response: unknown): PagedResponse<T> {
  const unwrapped = unwrapApiResponse<unknown>(response)

  if (Array.isArray(unwrapped)) {
    return { items: unwrapped as T[], totalCount: unwrapped.length }
  }

  if (isObject(unwrapped)) {
    const items = Array.isArray(unwrapped.items) ? (unwrapped.items as T[]) : []

    return {
      items,
      totalCount: typeof unwrapped.totalCount === 'number' ? unwrapped.totalCount : items.length,
      pageNumber: typeof unwrapped.pageNumber === 'number' ? unwrapped.pageNumber : undefined,
      pageSize: typeof unwrapped.pageSize === 'number' ? unwrapped.pageSize : undefined,
      totalPages: typeof unwrapped.totalPages === 'number' ? unwrapped.totalPages : undefined,
    }
  }

  return { items: [], totalCount: 0 }
}
