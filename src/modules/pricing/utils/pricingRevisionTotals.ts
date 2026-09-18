import type { RateRevisionDto } from '@/core/interfaces/pricing'

type JsonRecord = Record<string, unknown>

export interface PricingRevisionTotals {
  costUsd: number
  saleUsd: number
  utilityUsd: number
  costCrc: number
  saleCrc: number
  utilityCrc: number
  marginPercentage: number
  reconstructed: boolean
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function pick(source: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return null
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeCurrency(code: unknown, name: unknown) {
  const rawCode = String(code ?? '').trim().toUpperCase()
  const rawName = String(name ?? '').trim().toUpperCase()
  if (rawCode === 'CRC' || rawName.includes('CRC') || rawName.includes('COLON') || rawName.includes('COLÓN')) return 'CRC'
  return 'USD'
}

export function computePricingRevisionTotals(revision: RateRevisionDto): PricingRevisionTotals {
  let snapshot: JsonRecord = {}
  try {
    snapshot = record(JSON.parse(revision.snapshotJson || '{}'))
  } catch {
    snapshot = {}
  }

  const detailsRaw = pick(snapshot, 'Details', 'details')
  const details = Array.isArray(detailsRaw) ? detailsRaw.map(record) : []
  const exchangeRate = numberValue(
    pick(snapshot, 'ExchangeRateApplied', 'exchangeRateApplied')
      ?? pick(snapshot, 'ExchangeRateSale', 'exchangeRateSale'),
  )

  let costUsd = 0
  let saleUsd = 0
  let costCrc = 0
  let saleCrc = 0

  for (const detail of details) {
    const quantity = Math.max(0, numberValue(pick(detail, 'Quantity', 'quantity')) || 1)
    const cost = numberValue(pick(detail, 'CostAmount', 'costAmount')) * quantity
    const sale = numberValue(pick(detail, 'SaleAmount', 'saleAmount')) * quantity
    const currency = normalizeCurrency(
      pick(detail, 'CurrencyCode', 'currencyCode'),
      pick(detail, 'CurrencyName', 'currencyName'),
    )

    if (currency === 'CRC') {
      costCrc += cost
      saleCrc += sale
      if (exchangeRate > 0) {
        costUsd += cost / exchangeRate
        saleUsd += sale / exchangeRate
      }
    } else {
      costUsd += cost
      saleUsd += sale
      if (exchangeRate > 0) {
        costCrc += cost * exchangeRate
        saleCrc += sale * exchangeRate
      }
    }
  }

  const snapshotCostUsd = numberValue(pick(snapshot, 'TotalCostUsd', 'totalCostUsd'))
  const snapshotSaleUsd = numberValue(pick(snapshot, 'TotalSaleUsd', 'totalSaleUsd'))
  const snapshotCostCrc = numberValue(pick(snapshot, 'TotalCostCrc', 'totalCostCrc'))
  const snapshotSaleCrc = numberValue(pick(snapshot, 'TotalSaleCrc', 'totalSaleCrc'))

  const apiCostUsd = Number(revision.totalCostUsd ?? 0)
  const apiCostCrc = Number(revision.totalCostCrc ?? 0)
  const apiSaleUsd = Number(revision.totalSaleUsd ?? 0)
  const apiSaleCrc = Number(revision.totalSaleCrc ?? 0)

  const persistedCostUsd = apiCostUsd || snapshotCostUsd
  const persistedSaleUsd = apiSaleUsd || snapshotSaleUsd
  const persistedCostCrc = apiCostCrc || snapshotCostCrc
  const persistedSaleCrc = apiSaleCrc || snapshotSaleCrc

  const mustReconstruct = details.length > 0 && (
    (persistedCostUsd === 0 && persistedSaleUsd === 0)
    || (persistedCostCrc === 0 && persistedSaleCrc === 0)
  )

  const finalCostUsd = mustReconstruct ? costUsd : persistedCostUsd
  const finalSaleUsd = mustReconstruct ? saleUsd : persistedSaleUsd
  const finalCostCrc = mustReconstruct ? costCrc : persistedCostCrc
  const finalSaleCrc = mustReconstruct ? saleCrc : persistedSaleCrc
  const utilityUsd = finalSaleUsd - finalCostUsd
  const utilityCrc = finalSaleCrc - finalCostCrc
  const marginPercentage = finalSaleUsd > 0 ? (utilityUsd / finalSaleUsd) * 100 : Number(revision.marginPercentage || 0)

  return {
    costUsd: finalCostUsd,
    saleUsd: finalSaleUsd,
    utilityUsd,
    costCrc: finalCostCrc,
    saleCrc: finalSaleCrc,
    utilityCrc,
    marginPercentage,
    reconstructed: mustReconstruct,
  }
}
