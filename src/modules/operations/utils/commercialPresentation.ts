import { onMounted, ref } from 'vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { normalizeIncotermCode } from '@/modules/pricing/utils/pricingIncotermPerspective'
import { PricingService } from '@/core/services/pricingService'
import type { OperationsCaseWorkspace } from '../services/operationsApi'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const internal = /^[A-Z][A-Z0-9]+-\d{4}-\d+$/i
const icc = /^(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)$/
export function readable(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const text = String(value).trim()
  return uuid.test(text) || internal.test(text) ? '' : text
}
function catalogMatch(items: CatalogItemSelectDto[], raw: unknown) {
  const key = String(raw ?? '').trim().toLowerCase()
  if (!key) return undefined
  return items.find(x => [x.id,x.code,x.slug,x.label,x.value].some(v => String(v ?? '').toLowerCase() === key))
}
export function transportLabel(value: unknown): string {
  switch (String(value ?? '').toUpperCase()) {
    case 'FCL': case 'LCL': case 'MARITIME': return 'Marítimo'
    case 'FTL': case 'LTL': case 'LAND': return 'Terrestre'
    case 'AIR': return 'Aéreo'
    case 'MULTIMODAL': return 'Multimodal'
    default: return ''
  }
}
export function countryLabel(code: unknown, place: unknown): string {
  const iso = String(code ?? '').toUpperCase()
  if (/^[A-Z]{2}$/.test(iso)) {
    try { return new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' }).of(iso) || '' } catch { /* fallback to saved route label */ }
  }
  const parts = readable(place).split(',').map(x => x.trim()).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1]! : ''
}
export function mergeCommercialOpening(opening: Record<string, unknown>, summary: Record<string, unknown> | null | undefined, supplemental?: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...opening }
  for (const data of [summary, supplemental]) {
    if (!data) continue
    for (const [key,value] of Object.entries(data)) {
      if ((result[key] === null || result[key] === undefined || result[key] === '') && value !== null && value !== undefined && value !== '')
        result[key] = value
    }
  }
  result.transportType ||= transportLabel(result.shipmentType)
  return result
}
// Read the matching accepted revision only. Never replace historical values with a newer rate.
export async function sameRevisionCommercialData(workspace: OperationsCaseWorkspace): Promise<Record<string, unknown>> {
  const quote = workspace.quotes.find(q => q.isPrimary)
  if (!quote) return {}
  try {
    const rate = await PricingService.getRate(quote.quoteOptionId || quote.quoteId)
    if (rate.revisionNumber !== quote.snapshotVersion || rate.status !== 'AcceptedByClient') return {}
    return {
      incotermName: rate.incotermName, pickupAddress: rate.pickupAddress || rate.inlandPickupLocation?.address,
      destinationAddress: rate.inlandDeliveryLocation?.address, quoteReferences: rate.otherReferences,
      transitTime: rate.transitTime, freeDays: rate.freeDays, validFrom: rate.validFrom, validTo: rate.validTo,
      clientName: rate.clientName, executiveName: rate.executiveName,
    }
  } catch { return {} }
}
export function useCommercialLabels() {
  const incoterms = ref<CatalogItemSelectDto[]>([])
  const currencies = ref<CatalogItemSelectDto[]>([])
  onMounted(() => {
    void CatalogItemsService.select({catalogGroupSlug:'incoterms'}).then(x => incoterms.value = x).catch(() => {})
    void CatalogItemsService.select({catalogGroupSlug:'currencies'}).then(x => currencies.value = x).catch(() => {})
  })
  function incoterm(code: unknown, name?: unknown): string {
    const item = catalogMatch(incoterms.value, code)
    const term = normalizeIncotermCode(String(code ?? ''), [name,item?.label,item?.value,item?.slug].filter(Boolean).join(' '))
    return icc.test(term) ? term : ''
  }
  function currency(code: unknown, name?: unknown): string {
    const item = catalogMatch(currencies.value, code)
    for (const candidate of [name, item?.label, item?.value, item?.slug, code]) {
      const value = readable(candidate)
      if (!value) continue
      const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      if (/\busd\b|dolar|dollar/.test(normalized)) return 'USD'
      if (/\bcrc\b|colon costarricense|colones|^colon$/.test(normalized)) return 'CRC'
      if (/^[A-Z]{3}$/.test(value)) return value
      if (candidate !== code) return value
    }
    return ''
  }
  function openingField(key: string, data: Record<string, unknown>): string {
    if (key === 'incoterm') return incoterm(data.incoterm,data.incotermName)
    if (key === 'transportType') return transportLabel(data.transportType) || readable(data.transportType) || transportLabel(data.shipmentType)
    if (key === 'provenance') return ({Import:'Importación',Export:'Exportación',TransitDomestic:'Tránsito / doméstico'} as Record<string,string>)[String(data[key])] || ''
    return readable(data[key])
  }
  return { openingField, currency }
}
