import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-optional-charges-final-guard-20260930'

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  if (!source.includes('function addManualCharge() {')) return source

  const helper = `${MARKER}
function finalOptionalRelationMatches(
  relations: { id: string }[] | null | undefined,
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

function finalOptionalMatchesCurrentContext(cost: CostSelectDto) {
  if (cost.costType !== 'Optional') return false
  if (cost.isActive === false) return false

  const poeId = costContextPoeId()
  const shipmentMode = String(shipmentModeForApi.value ?? '').toLowerCase()
  const configuredModes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
    ? cost.shipmentModes.map((mode) => String(mode).toLowerCase())
    : cost.shipmentMode
      ? [String(cost.shipmentMode).toLowerCase()]
      : []

  if (configuredModes.length && !configuredModes.includes(shipmentMode)) return false

  if (!finalOptionalRelationMatches(cost.pols, cost.polId, form.originId)) return false
  if (!finalOptionalRelationMatches(cost.poes, cost.poeId, poeId)) return false
  if (!finalOptionalRelationMatches(cost.pods, cost.podId, form.podId)) return false
  if (!finalOptionalRelationMatches(cost.carriers, cost.carrierId, form.carrierId)) return false
  if (!finalOptionalRelationMatches(cost.agents, cost.agentId, form.agentId)) return false

  if (Array.isArray(cost.incoterms) && cost.incoterms.length) {
    if (!cost.incoterms.some((item) => String(item.id) === String(form.incotermId))) return false
  }

  if (Array.isArray(cost.services) && cost.services.length) {
    const selectedServices = new Set(form.serviceIds.map((id) => String(id)))
    if (!cost.services.some((item) => selectedServices.has(String(item.id)))) return false
  }

  return true
}

function ensureAllApplicableOptionalCosts() {
  if (props.viewOnly) return
  if (isOwnLclMatrixContext()) return

  const existing = new Map(costs.value.map((cost) => [cost.id, cost]))
  allCosts.value
    .filter(finalOptionalMatchesCurrentContext)
    .forEach((cost) => {
      if (!existing.has(cost.id)) {
        costs.value.push(cost)
        existing.set(cost.id, cost)
      }
    })

  mergeConfiguredOptionalCostsIntoRateLines(true)

  // Regla final de Pricing: todo Optional aplicable entra seleccionado.
  rateLines.value.forEach((line) => {
    if (line.optional) line.included = true
  })
}

const dholeOptionalChargesFinalGuard = watch(
  () => step.value,
  (currentStep) => {
    if (currentStep !== 7) return
    ensureAllApplicableOptionalCosts()
  },
  { flush: 'post' },
)

`

  return source.replace('function addManualCharge() {', helper + 'function addManualCharge() {')
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