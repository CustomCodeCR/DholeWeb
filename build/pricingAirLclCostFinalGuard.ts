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
  return form.modality === 'Air'
    && (shipmentModeForApi.value === 'AirConsol' || shipmentModeForApi.value === 'Lcl')
}

function airLclRelationMatches(
  relations: Array<{ id: string; name?: string | null; code?: string | null }> | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string | null | undefined,
  legacyName?: string | null,
  legacyCode?: string | null,
  selectedLabel?: string | null,
) {
  const selected = String(selectedId ?? '').trim()
  const relationList = Array.isArray(relations) ? relations : []
  const relationIds = relationList
    .map((item) => String(item.id ?? '').trim())
    .filter(Boolean)

  if (selected && relationIds.includes(selected)) return true

  const legacy = String(legacyId ?? '').trim()
  if (selected && legacy && legacy === selected) return true

  // Imported air rates can carry a provider/catalog snapshot whose Guid differs from
  // the current Config row. Fall back to the persisted name/code before rejecting an
  // otherwise identical AirConsol cost.
  const selectedText = normalizeCatalogValue(String(selectedLabel ?? ''))
  const configuredTexts = [
    ...relationList.flatMap((item) => [item.name, item.code]),
    legacyName,
    legacyCode,
  ]
    .map((value) => normalizeCatalogValue(String(value ?? '')))
    .filter(Boolean)

  if (selectedText && configuredTexts.some((value) =>
    value === selectedText || value.includes(selectedText) || selectedText.includes(value),
  )) return true

  const hasRestriction =
    relationIds.length > 0
    || Boolean(legacy)
    || configuredTexts.length > 0

  return !hasRestriction
}

function airLclCatalogLabel(item: CatalogItemSelectDto | null | undefined) {
  if (!item) return ''
  return [item.code, displayValue(item), item.label, item.value]
    .filter(Boolean)
    .join(' ')
}

function airLclSourceAgentLabel() {
  const source = lclSelectedSource.value
  return [
    source?.providerCode,
    source?.providerName,
    airLclCatalogLabel(selectedAgent.value),
  ]
    .filter(Boolean)
    .join(' ')
}

function airLclConfiguredModeMatches(cost: CostSelectDto) {
  const configuredModes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
    ? cost.shipmentModes.map((mode) => String(mode).toLowerCase())
    : cost.shipmentMode
      ? [String(cost.shipmentMode).toLowerCase()]
      : []

  if (!configuredModes.length) return true
  return configuredModes.includes('airconsol') || configuredModes.includes('any')
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

  if (!airLclRelationMatches(
    cost.pols,
    cost.polId,
    form.originId,
    cost.polName,
    cost.polCode,
    airLclCatalogLabel(selectedOrigin.value),
  )) return false

  if (!airLclRelationMatches(
    cost.poes,
    cost.poeId,
    form.destinationId,
    cost.poeName,
    cost.poeCode,
    airLclCatalogLabel(selectedDestination.value),
  )) return false

  if (!airLclRelationMatches(
    cost.pods,
    cost.podId,
    form.podId,
    cost.podName,
    cost.podCode,
    airLclCatalogLabel(selectedPod.value),
  )) return false

  if (!airLclRelationMatches(
    cost.carriers,
    cost.carrierId,
    form.carrierId,
    cost.carrierName,
    cost.carrierCode,
    airLclCatalogLabel(selectedCarrier.value),
  )) return false

  if (!airLclRelationMatches(
    cost.agents,
    cost.agentId,
    costContextAgentId(),
    cost.agentName,
    cost.agentCode,
    airLclSourceAgentLabel(),
  )) return false

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

    // For Air LCL the broad AirConsol query is intentional: imported tariff provider
    // snapshots can have a different Guid than the current Config agent. The matcher
    // above resolves route/provider by id first and then by name/code.
    costs.value = matchingCosts

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

function appendAirLclConfiguredCost(cost: CostSelectDto) {
  if (cost.costDetailType === 'Freight') return

  const duplicate = rateLines.value.some((line) =>
    (line.costId && line.costId === cost.id)
    || (
      line.costDetailType === cost.costDetailType
      && normalizeCatalogValue(line.name) === normalizeCatalogValue(cost.name)
    ),
  )
  if (duplicate) return

  const section = sectionForCost(cost)
  rateLines.value.push({
    key: 'cost:' + cost.id,
    section,
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    costId: cost.id,
    contextLabel: costContextLabel(cost),
    notes: cost.notes?.trim() || null,
    serviceIds: cost.services?.map((service) => service.id) ?? [],
    currencyId: cost.currencyId,
    currencyName: cost.currencyName,
    currencyCode: cost.currencyCode,
    amountCurrencyCode: cost.currencyCode,
    costAmount: number(cost.costAmount),
    saleAmount: number(cost.saleAmount),
    included: cost.costType !== 'Optional' || shouldIncludeOptionalCost(cost),
    optional: cost.costType === 'Optional',
    manual: false,
  })
}

function refreshAirLclRateLines() {
  if (!isAirLclPricingContext()) {
    rebuildRateLines()
    return
  }

  const source = lclSelectedSource.value
  const sourceLines = source?.kind === 'Coloader' && Array.isArray(source.lines)
    ? source.lines.map((line) => ({ ...line })) as RateLine[]
    : []
  const manualLines = rateLines.value.filter((line) => line.manual)

  // Start from Pricing's configured costs so Fixed/Variable AirConsol rows (AWB,
  // Manejos, etc.) are materialized. The previous guard replaced the whole list
  // with the coloader source and therefore only optional costs could be merged.
  rebuildRateLines()

  const rebuiltFreight = rateLines.value.find((line) => line.costDetailType === 'Freight')
  const sourceFreight = sourceLines.find((line) => line.costDetailType === 'Freight')
  if (rebuiltFreight) {
    rebuiltFreight.costAmount = number(form.freightCost)
    rebuiltFreight.saleAmount = number(form.freightSale)
    if (sourceFreight) {
      rebuiltFreight.chargeBasis = sourceFreight.chargeBasis
      rebuiltFreight.contextLabel = sourceFreight.contextLabel
      rebuiltFreight.notes = sourceFreight.notes
      rebuiltFreight.currencyId = sourceFreight.currencyId || rebuiltFreight.currencyId
      rebuiltFreight.currencyName = sourceFreight.currencyName || rebuiltFreight.currencyName
      rebuiltFreight.currencyCode = sourceFreight.currencyCode || rebuiltFreight.currencyCode
    }
  }

  const hasEquivalent = (candidate: RateLine) =>
    rateLines.value.some((line) =>
      (candidate.costId && line.costId === candidate.costId)
      || (
        line.costDetailType === candidate.costDetailType
        && normalizeCatalogValue(line.name) === normalizeCatalogValue(candidate.name)
      ),
    )

  // Rebuild can still be affected by legacy LCL transforms. Materialize every
  // matching AirConsol Fixed/Variable/Optional Cost explicitly so AWB, Retiro de AWB
  // and the remaining configured air charges cannot disappear from Pantalla 7.
  costs.value
    .filter(airLclCostMatchesCurrentContext)
    .forEach(appendAirLclConfiguredCost)

  // Keep source-specific air tariff lines that do not already exist in Costos y
  // recargos. Pricing-configured rows win on duplicates because they are the active
  // master for automatic charges.
  sourceLines
    .filter((line) => line.costDetailType !== 'Freight')
    .forEach((line) => {
      if (!hasEquivalent(line)) rateLines.value.push(line)
    })

  manualLines.forEach((line) => {
    if (!rateLines.value.some((existing) => existing.key === line.key)) {
      rateLines.value.push(line)
    }
  })

  mergeConfiguredOptionalCostsIntoRateLines(true)
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

  if (code.includes('function addManualCharge() {')) {
    code = code.replace(
      'function addManualCharge() {',
      helper + 'function addManualCharge() {',
    )
  }

  // pricingWizardStep4NavigationHardFix owns the final Screen 6 transition.
  // Patch its "new/recalculated quote" branch without depending on older anchors.
  const hardFixTransition = `      } else {
        // Ruta, naviera o agente sí cambió: aquí sí corresponde recalcular.
        await loadApplicableCosts()
        rebuildRateLines()
        persistedEditAppliedIncotermId.value = form.incotermId
      }`
  if (code.includes(hardFixTransition)) {
    code = code.replace(
      hardFixTransition,
      `      } else {
        // Ruta, naviera o agente sí cambió: aquí sí corresponde recalcular.
        await loadApplicableCosts()
        await ensureAllApplicableOptionalCosts()
        await ensureAirLclApplicableCosts()
        if (isAirLclPricingContext()) refreshAirLclRateLines()
        else rebuildRateLines()
        persistedEditAppliedIncotermId.value = form.incotermId
      }`,
    )
  } else {
    // Compatibility with branches where the navigation hard-fix is not present.
    const simpleTransition = `  if (step.value === 6) {
    await loadApplicableCosts()
    await ensureAllApplicableOptionalCosts()
    rebuildRateLines()
  }`
    if (code.includes(simpleTransition)) {
      code = code.replace(
        simpleTransition,
        `  if (step.value === 6) {
    await loadApplicableCosts()
    await ensureAllApplicableOptionalCosts()
    await ensureAirLclApplicableCosts()
    if (isAirLclPricingContext()) refreshAirLclRateLines()
    else rebuildRateLines()
  }`,
      )
    }
  }

  return code
}

export function pricingAirLclCostFinalGuard(): Plugin {
  return {
    name: 'dhole-pricing-air-lcl-cost-final-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
