export type CrmPreferentialScope = {
  id: string
  modality: string
  laneCode?: string | null
  carrierCode?: string | null
  incotermCode?: string | null
  equipmentCode?: string | null
  originCode?: string | null
  destinationCode?: string | null
  equipmentCodes?: string[] | null
  polCodes?: string[] | null
  poeCodes?: string[] | null
  podCodes?: string[] | null
  serviceCodes?: string[] | null
  validFrom?: string | null
  validUntil?: string | null
}
const norm = (x?: string | null) => String(x ?? '').trim().toUpperCase()
const list = (items?: string[] | null, legacy?: string | null) =>
  (items?.length ? items : legacy ? [legacy] : []).map(norm).sort().join(',')
/** An agreement block is one commercial scope, independent of where each line
 * was authored (route builder or the older single-item editor). No migration
 * or destructive re-save is required to reunite the persisted lines. */
export function customerAgreementScopeKey(rate: CrmPreferentialScope): string {
  return [
    norm(rate.modality), norm(rate.laneCode), norm(rate.carrierCode),
    norm(rate.incotermCode), list(rate.equipmentCodes,rate.equipmentCode),
    list(rate.polCodes,rate.originCode), list(rate.poeCodes,rate.destinationCode),
    list(rate.podCodes),list(rate.serviceCodes),
    String(rate.validFrom ?? ''),String(rate.validUntil ?? ''),
  ].join('|')
}
export function groupCustomerAgreementBlocks<T extends CrmPreferentialScope>(rates: T[]) {
  const buckets = new Map<string, T[]>()
  rates.forEach(rate => {
    const key = customerAgreementScopeKey(rate)
    const bucket = buckets.get(key) ?? []
    bucket.push(rate)
    buckets.set(key,bucket)
  })
  return [...buckets].map(([key, lines]) => ({ key, first: lines[0]!, lines }))
}
