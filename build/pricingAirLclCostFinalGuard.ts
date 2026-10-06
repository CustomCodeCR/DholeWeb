import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-air-lcl-cost-final-guard-20261006'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingAirLclCostFinalGuard] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  if (!source.includes('function addManualCharge() {')) return source

  let code = source

  const helper = MARKER + `
function isAirLclPricingContext() {
  return form.modality === 'Air' && shipmentModeForApi.value === 'Lcl'
}

function airLclRelationMatches(
  relations: Array<{ id: string }> | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string | null | undefined,
) {
  const selected = String(selectedId ?? '').trim()
  const relationIds = Array.isArray(relations)
    ? relations.map((item) => String(item.id ?? '').trim()).filter(Boolean)
    : []

  if (relationIds.length > 0) return Boolean(selected) && relationIds.includes(selected)

  const legacy = String(legacyId ?? '').trim()
  if (!legacy) return true
  return Boolean(selected) && legacy === selected
}

function airLclConfiguredModeMatches(cost: CostSelectDto) {
  const configuredModes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
    ? cost.shipmentModes.map((mode) => String(mode).toLowerCase())
    : cost.shipmentMode
      ? [String(cost.shipmentMode).toLowerCase()]
      : []

  if (!configuredModes.length) return true
  return configuredModes.includes('airconsol')
}

function airLclLegacyPortMatches(cost: CostSelectDto) {
  if (!cost.portId) return true

  const role = String(cost.portRole ?? '').toLowerCase()
  const selectedPolId = String(form.originId ?? '').trim()
  const selectedPoeId = String(form.destinationId ?? '').trim()
  const selectedPodId = String(form.podId ?? '').trim()

  if (role === 'pol') return String(cost.portId) === selectedPolId
  if (role === 'poe') return String(cost.portId) === selectedPoeId
  if (role === 'pod') return Boolean(selectedPodId) && String(cost.portId) === selectedPodId

  return [selectedPolId, selectedPoeId, selectedPodId]
    .filter(Boolean)
    .includes(String(cost.portId))
}

function airLclCostMatchesCurrentContext(cost: CostSelectDto) {
  if (!isAirLclPricingContext()) return false
  if (!airLclConfiguredModeMatches(cost)) return false

  if (!airLclRelationMatches(cost.pols, cost.polId, form.originId)) return false
  if (!airLclRelationMatches(cost.poes, cost.poeId, form.destinationId)) return false
  if (!airLclRelationMatches(cost.pods, cost.podId, form.podId)) return false
  if (!airLclRelationMatches(cost.carriers, cost.carrierId, form.carrierId)) return false
  if (!airLclRelationMatches(cost.agents, cost.agentId, costContextAgentId())) return false
  if (!airLclLegacyPortMatches(cost)) return false

  if (Array.isArray(cost.incoterms) && cost.incoterms.length) {
    if (!cost.incoterms.some((item) => String(item.id) === String(form.incotermId))) return false
  }

  if (Array.isArray(cost.services) && cost.services.length) {
    const selectedServices = new Set(form.serviceIds.map((id) => String(id)))
    if (!cost.services.some((item) => selectedServices.has(String(item.id)))) return false
  }

  if (!pickupCargoConditionsMatch(cost.operationalConditions)) return false

  return true
}

async function ensureAirLclApplicableCosts() {
  if (!isAirLclPricingContext() || props.viewOnly) return

  try {
    // shipmentMode intentionally bypasses the general select cache. Pricing's general
    // select endpoint returns the active catalog here; the browser applies the exact
    // AirConsol + route + agent context below.
    const freshCosts = await PricingService.selectCosts({
      shipmentMode: 'AirConsol',
      isActive: true,
    })

    const contextKey = dholeRuntimeCostContextKey()
    const matchingCosts = freshCosts
      .filter(airLclCostMatchesCurrentContext)
      .map((cost) => ({
        ...cost,
        __dholePricingContextKey: contextKey,
      }))

    const merged = new Map<string, CostSelectDto>()
    costs.value
      .filter(airLclCostMatchesCurrentContext)
      .forEach((cost) => merged.set(cost.id, {
        ...cost,
        __dholePricingContextKey: contextKey,
      }))
    matchingCosts.forEach((cost) => merged.set(cost.id, cost))
    costs.value = [...merged.values()]

    const allMerged = new Map(allCosts.value.map((cost) => [cost.id, cost]))
    matchingCosts.forEach((cost) => allMerged.set(cost.id, cost))
    allCosts.value = [...allMerged.values()]
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudieron refrescar los costos configurados para LCL aéreo.',
    )
  }
}

function refreshAirLclRateLines() {
  if (!isAirLclPricingContext()) {
    rebuildRateLines()
    return
  }

  const source = lclSelectedSource.value
  const manualLines = rateLines.value.filter((line) => line.manual)

  if (source?.kind === 'Coloader' && Array.isArray(source.lines) && source.lines.length) {
    rateLines.value = source.lines.map((line) => ({ ...line })) as RateLine[]

    const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')
    if (freight) {
      freight.costAmount = number(form.freightCost)
      freight.saleAmount = number(form.freightSale)
    }

    const existingKeys = new Set(rateLines.value.map((line) => line.key))
    manualLines.forEach((line) => {
      if (!existingKeys.has(line.key)) rateLines.value.push(line)
    })

    mergeConfiguredOptionalCostsIntoRateLines(true)
    return
  }

  rebuildRateLines()
}

const dholeAirLclCostStepGuard = watch(
  () => [
    step.value,
    form.originId,
    form.destinationId,
    form.podId,
    form.agentId,
    form.carrierId,
    form.incotermId,
    form.serviceIds.join('|'),
  ] as const,
  async ([currentStep]) => {
    if (currentStep !== 7 || !isAirLclPricingContext()) return
    await ensureAirLclApplicableCosts()
    refreshAirLclRateLines()
  },
  { flush: 'post' },
)

`

  code = replaceOne(
    code,
    'function addManualCharge() {',
    helper + 'function addManualCharge() {',
    'manual charge insertion point',
  )

  code = replaceOne(
    code,
    `  if (step.value === 6) {
    await loadApplicableCosts()
    await ensureAllApplicableOptionalCosts()
    rebuildRateLines()
  }`,
    `  if (step.value === 6) {
    await loadApplicableCosts()
    await ensureAllApplicableOptionalCosts()
    await ensureAirLclApplicableCosts()
    if (isAirLclPricingContext()) refreshAirLclRateLines()
    else rebuildRateLines()
  }`,
    'screen 6 to 7 cost refresh',
  )

  return code
}

export function pricingAirLclCostFinalGuard(): Plugin {
  return {
    name: 'dhole-pricing-air-lcl-cost-final-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
