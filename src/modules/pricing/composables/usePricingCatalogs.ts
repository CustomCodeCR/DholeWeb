import { computed, ref } from 'vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import type { CostDto, RateDto } from '@/core/interfaces/pricing'

export interface PricingCatalogItem {
  id: string
  name: string
  code: string
  slug: string
  value: string
}

export interface PricingOption {
  label: string
  value: string
}

const agents = ref<PricingCatalogItem[]>([])
const carriers = ref<PricingCatalogItem[]>([])
const currencies = ref<PricingCatalogItem[]>([])
const polPorts = ref<PricingCatalogItem[]>([])
const poePorts = ref<PricingCatalogItem[]>([])
const podPorts = ref<PricingCatalogItem[]>([])
const containerTypes = ref<PricingCatalogItem[]>([])
const importProfiles = ref<PricingCatalogItem[]>([])
const loading = ref(false)
const loaded = ref(false)
let activeLoad: Promise<void> | null = null

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function mapItem(item: CatalogItemDto): PricingCatalogItem {
  const displayValue = String(item.value || item.name).trim()
  const catalogCode = String(item.code || displayValue).trim()

  return {
    id: item.id,
    name: displayValue,
    code: catalogCode,
    slug: item.slug || normalize(displayValue).replace(/\s+/g, '-'),
    value: String(item.value || ''),
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
      const items = await CatalogItemsService.getByGroupSlug(slug)
      if (items.length > 0) return items.filter((item) => item.isActive !== false).map(mapItem)
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
      profileRows,
    ] = await Promise.all([
      loadFirstAvailable(['agents']),
      loadFirstAvailable(['carriers']),
      loadFirstAvailable(['currencies']),
      loadFirstAvailable(['pol']),
      loadFirstAvailable(['poe']),
      loadFirstAvailable(['pod']),
      loadFirstAvailable(['container-types']),
      loadFirstAvailable(['pricing-imports-profiles']),
    ])

    agents.value = agentRows
    carriers.value = carrierRows
    currencies.value = currencyRows.map(normalizeCurrency)
    polPorts.value = polRows
    poePorts.value = poeRows
    podPorts.value = podRows
    containerTypes.value = containerRows
    importProfiles.value = profileRows
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
      currencyName: currency?.name || cost.currencyName,
      currencyCode: currency?.code || cost.currencyCode,
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
    importProfiles,
    loading,
    loaded,
    agentOptions: computed(() => options(agents.value)),
    carrierOptions: computed(() => options(carriers.value)),
    currencyOptions: computed(() => nameOptions(currencies.value)),
    polOptions: computed(() => options(polPorts.value)),
    poeOptions: computed(() => options(poePorts.value)),
    podOptions: computed(() => options(podPorts.value)),
    containerOptions: computed(() => options(containerTypes.value)),
    profileOptions: computed(() => options(importProfiles.value)),
    loadAll,
    findById,
    findByCode,
    findBestMatch,
    resolveRateLabels,
    resolveCostLabels,
  }
}
