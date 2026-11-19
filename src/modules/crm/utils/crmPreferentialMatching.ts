/** Client-side preview mirrors CRM's authoritative resolver. Pricing itself is untouched. */
export interface PreferentialRule {
  id: string; modality: string; chargeCode: string; customChargeName?: string | null
  sourceCostId?: string | null; rateType: string; value: number | null
  laneCode?: string | null; carrierCode?: string | null; incotermCode?: string | null
  equipmentCodes?: string[]; polCodes?: string[]; poeCodes?: string[]; podCodes?: string[]
  serviceCodes?: string[]; equipmentCode?: string | null
  originCode?: string | null; destinationCode?: string | null
  validFrom?: string | null; validUntil?: string | null
  isActive: boolean; updatedAt?: string | null
}
export interface PreferentialSelection {
  modality: string; chargeCode?: string; customChargeName?: string
  sourceCostId?: string; laneCode?: string | null
  equipmentCode?: string; polCode?: string; poeCode?: string; podCode?: string
  carrierCode?: string; incotermCode?: string; serviceCode?: string
}
const norm = (value?: string | null) => String(value ?? '').trim().toUpperCase()
const charge = (value?: string) => ({
  FREIGHT:'Freight',PICKUP:'OriginCharge',ORIGIN:'OriginCharge',
  DELIVERY:'DestinationCharge',DESTINATION:'DestinationCharge',
  INSURANCE:'Insurance',CUSTOMS:'CustomsCharge',DOCUMENTATION:'Documentation',
} as Record<string,string>)[norm(value)] ?? value ?? ''
const choices = (list?: string[], legacy?: string | null) =>
  list?.length ? list : legacy ? [legacy] : []
const selected = (list: string[] | undefined, legacy: string | null | undefined, value?: string) => {
  const available = choices(list,legacy)
  return !available.length || (!!norm(value) && available.some(code => norm(code) === norm(value)))
}
const single = (rule?: string | null, selection?: string | null) =>
  !norm(rule) || (!!norm(selection) && norm(rule) === norm(selection))
export function matchesPreferentialRule(rate: PreferentialRule, request: PreferentialSelection, now = new Date()): boolean {
  if (!rate.isActive || norm(rate.modality) !== norm(request.modality)) return false
  if (rate.sourceCostId) {
    if (norm(rate.sourceCostId) !== norm(request.sourceCostId)) return false
  } else {
    if (!request.chargeCode || norm(charge(rate.chargeCode)) !== norm(charge(request.chargeCode))) return false
    if (rate.customChargeName && norm(rate.customChargeName) !== norm(request.customChargeName)) return false
  }
  const at = now.getTime()
  if (rate.validFrom && Date.parse(rate.validFrom) > at) return false
  if (rate.validUntil && Date.parse(rate.validUntil) < at) return false
  return single(rate.laneCode,request.laneCode) &&
    single(rate.carrierCode,request.carrierCode) &&
    single(rate.incotermCode,request.incotermCode) &&
    selected(rate.equipmentCodes,rate.equipmentCode,request.equipmentCode) &&
    selected(rate.polCodes,rate.originCode,request.polCode) &&
    selected(rate.poeCodes,rate.destinationCode,request.poeCode) &&
    selected(rate.podCodes,null,request.podCode) &&
    selected(rate.serviceCodes,null,request.serviceCode)
}
export function preferentialSpecificity(rule: PreferentialRule): number {
  return [rule.laneCode,rule.carrierCode,rule.incotermCode].filter(Boolean).length +
    [[rule.equipmentCodes,rule.equipmentCode],[rule.polCodes,rule.originCode],
    [rule.poeCodes,rule.destinationCode],[rule.podCodes,null],[rule.serviceCodes,null]]
      .filter(([list,legacy])=>choices(list as string[] | undefined,legacy as string | null | undefined).length>0).length
}
function scopeSize(rule: PreferentialRule) {
  return choices(rule.equipmentCodes,rule.equipmentCode).length+
    choices(rule.polCodes,rule.originCode).length+
    choices(rule.poeCodes,rule.destinationCode).length+
    choices(rule.podCodes).length+choices(rule.serviceCodes).length
}
export function mostSpecificPreferentialRate<T extends PreferentialRule>(
  rates: T[], request: PreferentialSelection, now = new Date(),
): T | undefined {
  return rates.filter(rate=>matchesPreferentialRule(rate,request,now))
    .sort((a,b)=>preferentialSpecificity(b)-preferentialSpecificity(a) ||
      scopeSize(a)-scopeSize(b) ||
      Date.parse(b.validFrom ?? '') - Date.parse(a.validFrom ?? '') ||
      norm(a.id).localeCompare(norm(b.id)))[0]
}
export function exactPreferentialScope(rate: PreferentialRule, selection: {
  modality:string; laneCode?:string | null; carrierCode?:string; incotermCode?:string
  equipmentCodes:string[]; polCodes:string[]; poeCodes:string[]; podCodes:string[]; serviceCodes:string[]
}): boolean {
  const equal = (a?:string[],b?:string[]) =>
    choices(a).map(norm).sort().join('|') === choices(b).map(norm).sort().join('|')
  return norm(rate.modality)===norm(selection.modality) &&
    norm(rate.laneCode)===norm(selection.laneCode) &&
    norm(rate.carrierCode)===norm(selection.carrierCode) &&
    norm(rate.incotermCode)===norm(selection.incotermCode) &&
    equal(choices(rate.equipmentCodes,rate.equipmentCode),selection.equipmentCodes) &&
    equal(choices(rate.polCodes,rate.originCode),selection.polCodes) &&
    equal(choices(rate.poeCodes,rate.destinationCode),selection.poeCodes) &&
    equal(rate.podCodes,selection.podCodes) && equal(rate.serviceCodes,selection.serviceCodes)
}
