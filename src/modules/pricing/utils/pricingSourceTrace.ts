import type { PricingImportEmailSourceDto } from '@/core/interfaces/emailExtraction'

export interface PricingSourceCarrier {
  importBatchId: string
  rawDataJson?: string | null
}

export interface PricingSourceTrace {
  emailMessageId?: string | null
  emailAttachmentId?: string | null
  subject?: string | null
  originalFileName?: string | null
  fromAddress?: string | null
}

function findTrace(value: unknown, depth = 0): PricingSourceTrace | null {
  if (!value || depth > 8) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const trace = findTrace(item, depth + 1)
      if (trace) return trace
    }
    return null
  }
  if (typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const explicit = record._dholeSource
  if (explicit && typeof explicit === 'object') return explicit as PricingSourceTrace

  if (typeof record.emailMessageId === 'string' && (typeof record.subject === 'string' || typeof record.originalFileName === 'string')) {
    return record as PricingSourceTrace
  }

  for (const child of Object.values(record)) {
    const trace = findTrace(child, depth + 1)
    if (trace) return trace
  }
  return null
}

export function sourceTraceFromRate(rate?: PricingSourceCarrier | null): PricingSourceTrace | null {
  const raw = String(rate?.rawDataJson ?? '').trim()
  if (!raw) return null
  try {
    return findTrace(JSON.parse(raw))
  } catch {
    return null
  }
}

export function sourceTitle(
  rate?: PricingSourceCarrier | null,
  resolved?: PricingImportEmailSourceDto | null,
) {
  const trace = sourceTraceFromRate(rate)
  return String(
    resolved?.subject || trace?.subject || resolved?.originalFileName || trace?.originalFileName || 'Fuente de la tarifa',
  ).trim()
}

export function sourcePopupUrl(rate: PricingSourceCarrier) {
  return `/pricing/email-source/${encodeURIComponent(rate.importBatchId)}`
}

export function openPricingSourcePopup(rate: PricingSourceCarrier) {
  const popup = window.open(
    sourcePopupUrl(rate),
    'dholePricingSource',
    'popup=yes,width=1280,height=860,resizable=yes,scrollbars=yes',
  )
  popup?.focus()
}
