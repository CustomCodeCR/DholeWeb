import { createUuid } from '@/core/utils/id'
import type { CostDetailType, RateDto, RateStatus } from '@/core/interfaces/pricing'

export function formatMoney(value: number | null | undefined, currency = 'USD', locale = 'es-CR') {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString(locale, { maximumFractionDigits: 2 })}`
  }
}

export function formatDate(value?: string | null, locale = 'es-CR') {
  if (!value) return '—'
  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(year, month - 1, day))
}

export function toDateInput(value?: string | null) {
  return value?.slice(0, 10) ?? ''
}

export function calculateMargin(cost: number, sale: number) {
  return sale <= 0 ? 0 : Number((((sale - cost) / sale) * 100).toFixed(2))
}

export function minimumSale(cost: number, margin = 12) {
  if (cost <= 0) return 0
  return Number((cost / (1 - margin / 100)).toFixed(2))
}

export function marginTone(margin: number) {
  if (margin >= 12) return 'success' as const
  if (margin >= 0) return 'warning' as const
  return 'danger' as const
}

export function statusTone(status: RateStatus | string) {
  if (status === 'Approved' || status === 'AcceptedByClient' || status === 'Created')
    return 'success' as const
  if (status === 'Sent') return 'primary' as const
  if (status === 'Pending' || status === 'PendingApproval' || status === 'Draft')
    return 'warning' as const
  if (status === 'Rejected' || status === 'RejectedByClient' || status === 'Expired')
    return 'danger' as const
  return 'neutral' as const
}

export function detailGroup(type: CostDetailType) {
  if (type === 'AgentCharge') return 'agent'
  if (type === 'Freight') return 'freight'
  if (type === 'DestinationCharge' || type === 'InlandTransport') return 'destination'
  return 'other'
}

export function routeLabel(rate: Pick<RateDto, 'polName' | 'poeName' | 'podName'>) {
  return [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ')
}

export function createCorrelationId() {
  return `pricing-web-${Date.now()}-${createUuid().slice(0, 8)}`
}
