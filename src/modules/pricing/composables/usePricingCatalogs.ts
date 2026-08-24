import { computed, ref } from 'vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type { CostDto, RateDto } from '@/core/interfaces/pricing'

export interface PricingCatalogItem {
  id: string
  name: string
  code: string
  slug: string
  value: string
  metadataJson: string | null
}

export interface PricingOption {
  label: string
  value: string
}

export interface ContainerEquipmentDimensions {
  size: string
  kind: string
  kindCode: string
}

export const PRICING_CATALOG_SLUGS = {
  carriers: 'carriers',
  pol: 'pol',
  pod: 'pod',
  poe: 'poe',
  currencies: 'currencies',
  agents: 'agents',
  // containerTypes remains the canonical equipment catalog for backwards compatibility.
  containerTypes: 'container-types',
  containerSizes: 'container-sizes',
  containerKinds: 'container-kinds',
  importProfiles: 'pricing-imports-profiles',
  incoterms: 'incoterms',
} as const

const agents = ref<PricingCatalogItem[]>([])
const carriers = ref<PricingCatalogItem[]>([])
const currencies = ref<PricingCatalogItem[]>([])
const polPorts = ref<PricingCatalogItem[]>([])
const poePorts = ref<PricingCatalogItem[]>([])
const podPorts = ref<PricingCatalogItem[]>([])
const containerTypes = ref<PricingCatalogItem[]>([])
const containerSizes = ref<PricingCatalogItem[]>([])
const containerKinds = ref<PricingCatalogItem[]>([])
const importProfiles = ref<PricingCatalogItem[]>([])
const incoterms = ref<PricingCatalogItem[]>([])
const loading = ref(false)
const loaded = ref(false)
let activeLoad: Promise<void> | null = null

const legacyKindSlugs: Record<string, string> = {
  DV: 'dry-van',
  HC: 'high-cube',
  OT: 'open-top',
  OS: 'open-side',
  TK: 'tank',
  FR: 'flat-rack',
  NOR: 'nor',
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function mapSelectItem(item: CatalogItemSelectDto): PricingCatalogItem {
  const displayName = String(item.label || item.value || item.code).trim()
  const catalogCode = String(item.code || item.value || displayName).trim()

  return {
    id: item.id,
    name: displayName,
    code: catalogCode,
    slug: item.slug || normalize(displayName).replace(/\s+/g, '-'),
    value: String(item.value || ''),
    metadataJson: item.metadataJson ?? null,
  }
}

function normalizeIncoterm(item: PricingCatalogItem): PricingCatalogItem {
  const displayValue = item.value.trim() || item.name.trim() || item.code.trim()

  return {
    ...item,
    name: displayValue,
  }
}

function normalizeCurrency(item: PricingCatalogItem): PricingCatalogItem {
  const isoLabel = [item.value, item.name, item.slug, item.code]
    .map((candidate) => candidate.trim())
    .find((candidate) => /^[a-z]{3}$/i.test(candidate))
    ?.toUpperCase()

  if (!isoLabel) return item

  return {
    ...item,
    name: isoLabel,
    code: isoLabel,
  }
}

async function loadFirstAvailable(slugs: string[]): Promise<PricingCatalogItem[]> {
  for (const slug of slugs) {
    try {
      const items = await CatalogItemsService.select({ catalogGroupSlug: slug })
      if (items.length > 0) return items.filter((item) => item.isActive !== false).map(mapSelectItem)
    } catch {
      // Try the compatibility slug used by older Config deployments.
    }
  }

  return []
}

async function loadAll(force = false) {
  if (loaded.value && !force) return
  if (activeLoad && !force) return activeLoad

  loading.value = true
  activeLoad = (async () => {
    const [
      agentRows,
      carrierRows,
      currencyRows,
      polRows,
      poeRows,
      podRows,
      containerRows,
      containerSizeRows,
      containerKindRows,
      profileRows,
      incotermRows,
    ] = await Promise.all([
      loadFirstAvailable([PRICING_CATALOG_SLUGS.agents]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.carriers]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.currencies]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.pol, 'ports']),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.poe, 'ports']),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.pod, 'ports']),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.containerTypes, 'containers-types']),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.containerSizes]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.containerKinds]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.importProfiles]),
      loadFirstAvailable([PRICING_CATALOG_SLUGS.incoterms]),
    ])

    agents.value = agentRows
    carriers.value = carrierRows
    currencies.value = currencyRows.map(normalizeCurrency)
    polPorts.value = polRows
    poePorts.value = poeRows
    podPorts.value = podRows
    containerTypes.value = containerRows
    containerSizes.value = containerSizeRows
    containerKinds.value = containerKindRows
    importProfiles.value = profileRows
    incoterms.value = incotermRows.map(normalizeIncoterm)
    loaded.value = true
  })().finally(() => {
    loading.value = false
    activeLoad = null
  })

  return activeLoad
}

function options(items: PricingCatalogItem[]) {
  return items.map((item) => ({
    label: item.name,
    value: item.id,
  }))
}

function nameOptions(items: PricingCatalogItem[]) {
  return items.map((item) => ({
    label: item.name,
    value: item.id,
  }))
}

function findById(items: PricingCatalogItem[], id?: string | null) {
  return items.find((item) => item.id === id)
}

function findByCode(items: PricingCatalogItem[], value?: string | null) {
  const target = normalize(value ?? '')
  if (!target) return undefined

  return items.find((item) =>
    [item.code, item.name, item.slug, item.value].some(
      (candidate) => normalize(candidate) === target,
    ),
  )
}

function compact(value: string) {
  return normalize(value).replace(/[^a-z0-9]/g, '')
}

function equipmentDimensions(item?: PricingCatalogItem | null): ContainerEquipmentDimensions | null {
  if (!item) return null

  if (item.metadataJson) {
    try {
      const metadata = JSON.parse(item.metadataJson) as Record<string, unknown>
      const size = String(metadata.size ?? '').trim()
      const kind = String(metadata.kind ?? '').trim()
      const kindCode = String(metadata.kindCode ?? '').trim().toUpperCase()
      if (size && kind && kindCode) return { size, kind, kindCode }
    } catch {
      // Fall back to the legacy equipment code below.
    }
  }

  const match = compact(item.code || item.value || item.name).toUpperCase().match(/^(20|40|45|48)(DV|HC|OT|OS|TK|FR|NOR)$/)
  if (!match) return null

  const size = match[1]
  const kindCode = match[2]
  if (!size || !kindCode) return null

  return {
    size,
    kindCode,
    kind: legacyKindSlugs[kindCode] ?? kindCode.toLowerCase(),
  }
}

function splitContainerEquipment(equipmentId?: string | null) {
  const equipment = findById(containerTypes.value, equipmentId)
  const dimensions = equipmentDimensions(equipment)
  if (!equipment || !dimensions) {
    return { equipment, size: undefined, kind: undefined }
  }

  const size = containerSizes.value.find((item) =>
    [item.code, item.value, item.slug].some((candidate) => candidate === dimensions.size),
  )
  const kind = containerKinds.value.find(
    (item) => item.slug === dimensions.kind || item.code.toUpperCase() === dimensions.kindCode,
  )

  return { equipment, size, kind }
}

function containerKindsForSize(sizeId?: string | null) {
  const size = findById(containerSizes.value, sizeId)
  if (!size) return containerKinds.value

  const sizeCode = size.code || size.value || size.slug
  const allowed = new Set(
    containerTypes.value
      .map(equipmentDimensions)
      .filter((dimension): dimension is ContainerEquipmentDimensions => Boolean(dimension))
      .filter((dimension) => dimension.size === sizeCode)
      .map((dimension) => dimension.kindCode),
  )

  return containerKinds.value.filter((kind) => allowed.has(kind.code.toUpperCase()))
}

function resolveContainerEquipment(sizeId?: string | null, kindId?: string | null) {
  const size = findById(containerSizes.value, sizeId)
  const kind = findById(containerKinds.value, kindId)
  if (!size || !kind) return undefined

  const sizeCode = size.code || size.value || size.slug
  const kindCode = kind.code.toUpperCase()

  return containerTypes.value.find((equipment) => {
    const dimensions = equipmentDimensions(equipment)
    return dimensions?.size === sizeCode && dimensions.kindCode === kindCode
  })
}

function findBestMatch(
  items: PricingCatalogItem[],
  id: string | null | undefined,
  ...values: Array<string | number | null | undefined>
) {
  const exactId = findById(items, id)
  if (exactId) return exactId

  const candidates = [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
  let best: { item: PricingCatalogItem; score: number } | undefined

  for (const item of items) {
    const itemValues = [item.code, item.name, item.slug, item.value]
      .map((value) => normalize(value))
      .filter(Boolean)
    const compactItemValues = itemValues.map(compact)

    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate)
      const compactCandidate = compact(candidate)
      if (!normalizedCandidate) continue

      let score = 0
      if (itemValues.includes(normalizedCandidate)) score = 1000
      else if (compactCandidate && compactItemValues.includes(compactCandidate)) score = 950
      else if (
        normalizedCandidate.length >= 3 &&
        itemValues.some(
          (value) => value.includes(normalizedCandidate) || normalizedCandidate.includes(value),
        )
      ) {
        score = 700 + Math.min(normalizedCandidate.length, 100)
      }

      if (!best || score > best.score) best = score > 0 ? { item, score } : best
    }
  }

  return best?.item
}

export function usePricingCatalogs() {
  function resolveRateLabels(rate: RateDto): RateDto {
    const label = (
      items: PricingCatalogItem[],
      id: string | null | undefined,
      fallback?: string | null,
    ) => items.find((item) => item.id === id)?.name || fallback || '—'

    return {
      ...rate,
      agentName: label(agents.value, rate.agentId, rate.agentName),
      carrierName: label(carriers.value, rate.carrierId, rate.carrierName),
      polName: label(polPorts.value, rate.polId, rate.polName),
      poeName: label(poePorts.value, rate.poeId, rate.poeName),
      podName: label(podPorts.value, rate.podId, rate.podName),
      containerTypeName: label(containerTypes.value, rate.containerTypeId, rate.containerTypeName),
      incotermName:
        incoterms.value.find((item) => item.id === rate.incotermId)?.value?.trim() ||
        label(incoterms.value, rate.incotermId, rate.incotermName),
      incotermCode:
        incoterms.value.find((item) => item.id === rate.incotermId)?.code || rate.incotermCode,
      currencyName: label(currencies.value, rate.currencyId, rate.currencyName),
      currencyCode:
        currencies.value.find((item) => item.id === rate.currencyId)?.code || rate.currencyCode,
    }
  }

  function resolveCostLabels(cost: CostDto): CostDto {
    const portCatalog =
      cost.portRole === 'Pol'
        ? polPorts.value
        : cost.portRole === 'Poe'
          ? poePorts.value
          : cost.portRole === 'Pod'
            ? podPorts.value
            : [...polPorts.value, ...poePorts.value, ...podPorts.value]
    const currency = currencies.value.find((item) => item.id === cost.currencyId)

    return {
      ...cost,
      agentName: agents.value.find((item) => item.id === cost.agentId)?.name || cost.agentName,
      carrierName:
        carriers.value.find((item) => item.id === cost.carrierId)?.name || cost.carrierName,
      portName: portCatalog.find((item) => item.id === cost.portId)?.name || cost.portName,
      polName: polPorts.value.find((item) => item.id === cost.polId)?.name || cost.polName,
      polCode: polPorts.value.find((item) => item.id === cost.polId)?.code || cost.polCode,
      poeName: poePorts.value.find((item) => item.id === cost.poeId)?.name || cost.poeName,
      poeCode: poePorts.value.find((item) => item.id === cost.poeId)?.code || cost.poeCode,
      podName: podPorts.value.find((item) => item.id === cost.podId)?.name || cost.podName,
      podCode: podPorts.value.find((item) => item.id === cost.podId)?.code || cost.podCode,
      currencyName: currency?.name || cost.currencyName,
      currencyCode: currency?.code || cost.currencyCode,
      incoterms: (cost.incoterms ?? []).map((incoterm) => {
        const current = incoterms.value.find((item) => item.id === incoterm.id)
        return current ? { id: current.id, name: current.name, code: current.code } : incoterm
      }),
    }
  }

  return {
    agents,
    carriers,
    currencies,
    polPorts,
    poePorts,
    podPorts,
    containerTypes,
    containerSizes,
    containerKinds,
    importProfiles,
    incoterms,
    loading,
    loaded,
    agentOptions: computed(() => options(agents.value)),
    carrierOptions: computed(() => options(carriers.value)),
    currencyOptions: computed(() => nameOptions(currencies.value)),
    polOptions: computed(() => options(polPorts.value)),
    poeOptions: computed(() => options(poePorts.value)),
    podOptions: computed(() => options(podPorts.value)),
    containerOptions: computed(() => options(containerTypes.value)),
    containerSizeOptions: computed(() => options(containerSizes.value)),
    containerKindOptions: computed(() => options(containerKinds.value)),
    profileOptions: computed(() => options(importProfiles.value)),
    incotermOptions: computed(() => options(incoterms.value)),
    loadAll,
    findById,
    findByCode,
    findBestMatch,
    equipmentDimensions,
    splitContainerEquipment,
    containerKindsForSize,
    resolveContainerEquipment,
    resolveRateLabels,
    resolveCostLabels,
  }
}
