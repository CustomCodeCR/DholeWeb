import type { RateDto } from '@/core/interfaces/pricing'
import type { GroupQuoteSnapshot } from '@/core/services/pricingService'
import type { OperationsCaseRow, OperationsCaseFilters, Paged } from '@/modules/operations/services/operationsApi'

export type RateIdtraLookup =
  | { state: 'found'; idtras: string[] }
  | { state: 'missing' | 'error' }

export function historicalIdtra(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim()
  return /^(pendiente(?: de asignar)?|sin idtra|sin asignar|no asignado|n\/a)$/i.test(trimmed) ? '' : trimmed
}

// Only exact identifier matches are removed; legacy aliases are not assumed.
export function unverifiedHistoricalIdtras(value: string | null | undefined, confirmed: readonly string[]): string[] {
  const seen = new Set(confirmed.map(id => id.trim().toUpperCase()))
  return String(value ?? '').split(',').map(historicalIdtra).filter(id => {
    const key = id.toUpperCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Pricing keeps historical references; Operations is authoritative for new openings.
export async function resolveRateOperationsIdtras(
  rate: Pick<RateDto, 'id' | 'groupAlternativeCount' | 'groupQuoteNumber'>,
  getGroup: (id: string) => Promise<GroupQuoteSnapshot | null>,
  getCases: (page: number, filters: OperationsCaseFilters, pageSize: number) => Promise<Paged<OperationsCaseRow>>,
): Promise<RateIdtraLookup> {
  try {
    const group = (Number(rate.groupAlternativeCount || 0) > 1 || rate.groupQuoteNumber)
      ? await getGroup(rate.id) : null
    const belongs = group?.alternatives.some(option => option.rateId === rate.id)
    if (group && !belongs) return { state: 'error' }
    const parent = group?.parentRateId || rate.id
    const option = group?.selectedRateId || rate.id
    const identifiers = new Set<string>()
    const pageSize = 25
    for (let page = 1; ; page++) {
      const result = await getCases(page, { q: parent }, pageSize)
      for (const row of result.items) {
        if (row.sourceQuoteId !== parent || row.sourceQuoteOptionId !== option) continue
        const idtra = historicalIdtra(row.idtra)
        if (idtra) identifiers.add(idtra)
      }
      if (page * pageSize >= result.total || result.items.length === 0) break
    }
    return identifiers.size ? { state: 'found', idtras: [...identifiers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) } : { state: 'missing' }
  } catch {
    return { state: 'error' }
  }
}
