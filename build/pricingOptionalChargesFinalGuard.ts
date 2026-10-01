import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-optional-charges-final-guard-20260930'

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  if (!source.includes('function addManualCharge() {')) return source

  let code = source

  const helper = `${MARKER}
function finalOptionalRelationMatches(
  relations: { id: string; name?: string; code?: string }[] | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string,
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

function finalOptionalPanamaText(value: unknown) {
  const text = normalizeCatalogValue(String(value ?? ''))
  return text.includes('panama')
    || text.includes('balboa')
    || text.includes('colon free zone')
    || text.includes('zona libre colon')
    || text.includes('cfz')
}

function finalOptionalPoeMatches(cost: CostSelectDto) {
  const selectedPoeId = costContextPoeId()
  const relations = Array.isArray(cost.poes) ? cost.poes : []

  if (relations.length > 0) {
    if (relations.some((item) => String(item.id) === String(selectedPoeId))) return true
    if (
      isMultimodalViaPanama(selectedDestination.value)
      && relations.some((item) => finalOptionalPanamaText(item.name) || finalOptionalPanamaText(item.code))
    ) return true
    return false
  }

  if (!cost.poeId) return true
  if (String(cost.poeId) === String(selectedPoeId)) return true

  return isMultimodalViaPanama(selectedDestination.value)
    && (finalOptionalPanamaText(cost.poeName) || finalOptionalPanamaText(cost.poeCode))
}

function finalOptionalLegacyPortMatches(cost: CostSelectDto) {
  if (!cost.portId) return true

  const role = String(cost.portRole ?? '').toLowerCase()
  if (role === 'pol') return String(cost.portId) === String(form.originId)
  if (role === 'pod') return String(cost.portId) === String(form.podId)
  if (role === 'poe') {
    if (String(cost.portId) === String(costContextPoeId())) return true
    return isMultimodalViaPanama(selectedDestination.value)
      && (finalOptionalPanamaText(cost.portName) || finalOptionalPanamaText(cost.portCode))
  }

  if (
    [form.originId, costContextPoeId(), form.podId]
      .filter(Boolean)
      .some((id) => String(id) === String(cost.portId))
  ) return true

  return isMultimodalViaPanama(selectedDestination.value)
    && (finalOptionalPanamaText(cost.portName) || finalOptionalPanamaText(cost.portCode))
}

function finalOptionalMatchesCurrentContext(cost: CostSelectDto) {
  if (cost.costType !== 'Optional') return false
  if (cost.isActive === false) return false

  const shipmentMode = String(shipmentModeForApi.value ?? '').toLowerCase()
  const configuredModes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
    ? cost.shipmentModes.map((mode) => String(mode).toLowerCase())
    : cost.shipmentMode
      ? [String(cost.shipmentMode).toLowerCase()]
      : []

  if (configuredModes.length && !configuredModes.includes(shipmentMode)) return false

  if (!finalOptionalRelationMatches(cost.pols, cost.polId, form.originId)) return false
  if (!finalOptionalPoeMatches(cost)) return false
  if (!finalOptionalRelationMatches(cost.pods, cost.podId, form.podId)) return false
  if (!finalOptionalRelationMatches(cost.carriers, cost.carrierId, form.carrierId)) return false
  if (!finalOptionalRelationMatches(cost.agents, cost.agentId, form.agentId)) return false
  if (!finalOptionalLegacyPortMatches(cost)) return false

  // Incoterm y servicio continúan siendo restricciones cuando fueron configurados
  // explícitamente en Costos y recargos.
  if (Array.isArray(cost.incoterms) && cost.incoterms.length) {
    if (!cost.incoterms.some((item) => String(item.id) === String(form.incotermId))) return false
  }

  if (Array.isArray(cost.services) && cost.services.length) {
    const selectedServices = new Set(form.serviceIds.map((id) => String(id)))
    if (!cost.services.some((item) => selectedServices.has(String(item.id)))) return false
  }

  return true
}

async function loadAllApplicableOptionalCosts() {
  const optionalCosts = await PricingService.selectCosts({
    costType: 'Optional',
    isActive: true,
  })

  return optionalCosts
    .filter(finalOptionalMatchesCurrentContext)
    .filter((cost) => shouldIncludeOptionalCost(cost))
}

async function ensureAllApplicableOptionalCosts() {
  if (props.viewOnly) return
  if (isOwnLclMatrixContext()) return

  try {
    const optionalCosts = await loadAllApplicableOptionalCosts()
    const contextKey = currentCostContextKey()
    const merged = new Map(costs.value.map((cost) => [cost.id, cost]))

    optionalCosts.forEach((cost) => {
      merged.set(cost.id, {
        ...cost,
        __dholePricingContextKey: contextKey,
      })
    })

    costs.value = [...merged.values()]

    // Mantener también el catálogo completo actualizado para cambios posteriores
    // de ruta/proveedor dentro del mismo borrador.
    const allMerged = new Map(allCosts.value.map((cost) => [cost.id, cost]))
    optionalCosts.forEach((cost) => allMerged.set(cost.id, cost))
    allCosts.value = [...allMerged.values()]

    mergeConfiguredOptionalCostsIntoRateLines(true)
    syncHaulageOptionalLines()
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudieron cargar los cargos opcionales aplicables a esta cotización.',
    )
  }
}

const dholeOptionalChargesFinalGuard = watch(
  () => step.value,
  async (currentStep) => {
    if (currentStep !== 7) return
    await ensureAllApplicableOptionalCosts()
  },
  { flush: 'post' },
)

`

  code = code.replace('function addManualCharge() {', helper + 'function addManualCharge() {')

  // Ejecutar el mismo guard antes de construir Pantalla 7; esto elimina carreras entre
  // watchers y garantiza que rebuildRateLines ya reciba los Optional.
  code = code.replace(
    `  if (step.value === 6) {
    await loadApplicableCosts()
    rebuildRateLines()
  }`,
    `  if (step.value === 6) {
    await loadApplicableCosts()
    await ensureAllApplicableOptionalCosts()
    rebuildRateLines()
  }`,
  )

  return code
}
export function pricingOptionalChargesFinalGuard(): Plugin {
  return {
    name: 'dhole-pricing-optional-charges-final-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}