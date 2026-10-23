import type { NotificationInboxItemDto } from '../interfaces/notifications'

type NotificationPayload = Record<string, unknown>

// Notification messages may come from several services and do not all have a route.
function readPayload(json: string): NotificationPayload {
  try {
    const value: unknown = JSON.parse(json)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as NotificationPayload
      : {}
  } catch {
    return {}
  }
}

function readText(payload: NotificationPayload, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readId(payload: NotificationPayload, ...keys: string[]): string | null {
  const value = readText(payload, ...keys)
  return value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null
}

function validEntityId(value: string | null): string | null {
  return value && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null
}

/** Reject external URLs, protocol-relative links and unsafe paths from notification payloads. */
export function safeNotificationRoute(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || raw.length > 2048 || raw.startsWith('//') || /[\\\u0000-\u001f]/.test(raw)) return null
  if (!raw.startsWith('/') && !/^https?:\/\//i.test(raw)) return null

  try {
    const url = new URL(raw, origin)
    if (url.origin !== origin || !url.pathname.startsWith('/')) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

/**
 * Prefer the producer's explicit route; fall back to its action/entity metadata.
 * Returns a same-origin application route only. The caller still verifies it exists
 * in Vue Router and lets the normal authorization guard enforce access.
 */
export function resolveNotificationDestination(
  item: NotificationInboxItemDto,
  origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): string | null {
  const payload = readPayload(item.payloadJson)
  const kind = (readText(payload, 'type') ?? item.notificationType ?? '').toLowerCase()
  const action = (readText(payload, 'action') ?? '').toLowerCase()
  const entityType = (item.entityType ?? '').toLowerCase()
  const entityId = validEntityId(item.entityId)
  const batchId = readId(payload, 'importBatchId', 'ImportBatchId')

  // The auto-preauthorized email import alert should open the actual batch queue.
  if ((kind === 'pricing.imported-rate.approval-required' || action === 'review-imported-rates') && batchId) {
    return `/pricing/imports?importBatchId=${encodeURIComponent(batchId)}`
  }

  const explicit = safeNotificationRoute(
    readText(payload, 'route', 'url', 'path', 'deepLink', 'link'),
    origin,
  )
  if (explicit) return explicit

  const comparisonId = readId(payload, 'comparisonId', 'ComparisonId')
  if (comparisonId && (action === 'review-rate-comparison' || kind.includes('rate-comparison') || kind.includes('lower-complete-rate'))) {
    return `/pricing/rate-comparisons/${comparisonId}`
  }

  const requestId = readId(payload, 'rateRequestId', 'RateRequestId')
    ?? (entityType === 'raterequest' ? entityId : null)
  if (requestId && (entityType === 'raterequest' || kind.startsWith('pricing.rate-request.') || action === 'complete-rate-request')) {
    return `/pricing/rate-requests/${requestId}/wizard`
  }

  const rateId = readId(payload, 'rateId', 'RateId')
    ?? (['rateheader', 'rate', 'quotation', 'quote'].includes(entityType) ? entityId : null)
  if (rateId && (kind.startsWith('pricing.rate.') || action === 'open-rate' || ['rateheader', 'rate', 'quotation', 'quote'].includes(entityType))) {
    return `/pricing/rates/${rateId}/wizard?mode=view`
  }

  if (kind.startsWith('pricing.imported-rate.') || entityType === 'importfclrate' || action === 'review-imported-rates') {
    return '/pricing/imports'
  }

  return null
}
