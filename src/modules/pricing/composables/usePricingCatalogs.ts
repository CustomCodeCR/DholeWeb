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

  return {
    id: item.id,
    name: displayValue,
    code: displayValue || item.code,
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
    [item.code, item.name, item.slug].some((candidate) => normalize(candidate) === target),
  )
}

export function usePricingCatalogs() {
  function resolveRateLabels(rate: RateDto): RateDto {
    const label = (items: PricingCatalogItem[], id: string | null | undefined, fallback?: string | null) =>
      items.find((item) => item.id === id)?.name || fallback || '—'

    return {
      ...rate,
      agentName: label(agents.value, rate.agentId, rate.agentName),
      carrierName: label(carriers.value, rate.carrierId, rate.carrierName),
      polName: label(polPorts.value, rate.polId, rate.polName),
      poeName: label(poePorts.value, rate.poeId, rate.poeName),
      podName: label(podPorts.value, rate.podId, rate.podName),
      containerTypeName: label(containerTypes.value, rate.containerTypeId, rate.containerTypeName),
      currencyName: label(currencies.value, rate.currencyId, rate.currencyName),
      currencyCode: currencies.value.find((item) => item.id === rate.currencyId)?.code || rate.currencyCode,
    }
  }

  function resolveCostLabels(cost: CostDto): CostDto {
    const portCatalog = cost.portRole === 'Pol'
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
      carrierName: carriers.value.find((item) => item.id === cost.carrierId)?.name || cost.carrierName,
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
    resolveRateLabels,
    resolveCostLabels,
  }
}
