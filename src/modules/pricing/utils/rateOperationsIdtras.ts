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
