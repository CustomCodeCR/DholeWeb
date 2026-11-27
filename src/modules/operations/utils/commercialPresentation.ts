import { computed, onMounted, ref, watch } from 'vue'
import { StorageService, parseStorageReference } from '@/core/services/storageService'
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
    case 'FTL': case 'LTL': case 'LAND': case 'ROAD': return 'Terrestre'
    case 'AIR': case 'AIRCONSOL': return 'Aéreo'
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
      if (key === 'supportDocuments' && Array.isArray(value)) {
        const current = Array.isArray(result[key]) ? result[key] as unknown[] : []
        const documents = new Map<string, Record<string, unknown>>()
        for (const entry of [...value, ...current]) {
          if (!entry || typeof entry !== 'object') continue
          const doc = entry as Record<string, unknown>
          const id = String(doc.storageId || doc.id || '').trim()
          if (id) documents.set(id.toLowerCase(), { ...documents.get(id.toLowerCase()), ...doc })
        }
        result[key] = [...documents.values()]
      } else if ((result[key] === null || result[key] === undefined || result[key] === '') && value !== null && value !== undefined && value !== '')
        result[key] = value
    }
  }
  result.transportType ||= transportLabel(result.shipmentType)
  return result
}
// Existing Storage API remains the authority for file metadata and downloads.
export function useOpeningDocuments(source: () => unknown) {
  const names = ref<Record<string, string>>({})
  const documentError = ref('')
  let sequence = 0
  const references = computed(() => {
    const values = source()
    if (!Array.isArray(values)) return []
    return values.flatMap(value => {
      if (!value || typeof value !== 'object') return []
      const doc = value as Record<string, unknown>
      const id = String(doc.storageId || doc.id || '')
      const storageId = parseStorageReference(id)
      const fileName = String(doc.fileName || 'Adjunto de Pricing')
      return [{ id: id || fileName, storageId, fileName, label: String(doc.categoryLabel || doc.label || 'Documento') }]
    })
  })
  watch(() => references.value.map(doc => doc.storageId).join(','), async () => {
    const current = ++sequence
    names.value = {}
    documentError.value = ''
    const resolved = await Promise.all(references.value.map(async doc => {
      if (!doc.storageId) return null
      try {
        const file = await StorageService.getFile(doc.storageId)
        return [doc.storageId, file.originalFileName] as const
      } catch { return null }
    }))
    if (current === sequence) names.value = Object.fromEntries(resolved.filter(x => x !== null))
  }, { immediate: true })
  const openingDocuments = computed(() => references.value.map(doc => ({
    ...doc, fileName: (doc.storageId && names.value[doc.storageId]) || doc.fileName,
  })))
  async function downloadDocument(doc: (typeof openingDocuments.value)[number]) {
    if (!doc.storageId) return
    documentError.value = ''
    try {
      const file = await StorageService.getFile(doc.storageId)
      await StorageService.downloadFile({ id: file.id, fileName: file.originalFileName, contentType: file.contentType, extension: file.extension })
    } catch {
      documentError.value = 'No se pudo recuperar el archivo de Storage. Verifique que exista y que tenga permiso de acceso.'
    }
  }
  return { openingDocuments, downloadDocument, documentError }
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
  const services = ref<CatalogItemSelectDto[]>([])
  onMounted(() => {
    void CatalogItemsService.select({catalogGroupSlug:'incoterms'}).then(x => incoterms.value = x).catch(() => {})
    void CatalogItemsService.select({catalogGroupSlug:'currencies'}).then(x => currencies.value = x).catch(() => {})
    void CatalogItemsService.select({catalogGroupSlug:'pricing-services'}).then(x => services.value = x).catch(() => {})
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
    if (['isImo', 'stackable', 'overweight'].includes(key)) return data[key] === true ? 'Sí' : data[key] === false ? 'No' : ''
    if (key === 'incoterm') return incoterm(data.incoterm,data.incotermName)
    if (key === 'transportType') return transportLabel(data.transportType) || readable(data.transportType) || transportLabel(data.shipmentType)
    if (key === 'provenance') return ({Import:'Importación',Export:'Exportación',TransitDomestic:'Tránsito / doméstico'} as Record<string,string>)[String(data[key])] || ''
    if (key === 'validFrom' || key === 'validTo') {
      const value = readable(data[key])
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10).split('-').reverse().join('/')
    }
    return readable(data[key])
  }
  function serviceLabels(data: Record<string, unknown>): string[] {
    const labels = new Set<string>()
    const selections = Array.isArray(data.serviceSelections) ? data.serviceSelections : []
    const values = Array.isArray(data.services) ? data.services : []
    for (const entry of [...selections, ...values]) {
      const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      const raw = typeof entry === 'string' ? entry : row.id ?? row.serviceId ?? row.pricingServiceId ?? row.code ?? row.serviceCode
      const item = catalogMatch(services.value, raw)
      const selected = selections.find(value => value && typeof value === 'object' &&
        String((value as Record<string, unknown>).id ?? '') === String(raw ?? '')) as Record<string, unknown> | undefined
      labels.add(readable(row.label) || readable(row.serviceName) || readable(row.name) ||
        readable(selected?.label) || readable(item?.label) || readable(item?.value) ||
        readable(raw) || 'Servicio pendiente de identificar')
    }
    return [...labels]
  }
  return { openingField, currency, serviceLabels }
}
