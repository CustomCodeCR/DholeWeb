import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-runtime-reference-guard-20260925'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source
  if (code.includes(MARKER)) return code

  code = replaceOptional(
    code,
    '    const contextKey = currentCostContextKey()',
    '    const contextKey = dholeRuntimeCostContextKey()',
  )
  code = replaceOptional(
    code,
    '    const importRateId = costContextImportRateId()',
    '    const importRateId = dholeRuntimeCostContextImportRateId()',
  )
  code = replaceOptional(
    code,
    '      poeId: costContextPoeId() || undefined,',
    '      poeId: dholeRuntimeCostContextPoeId() || undefined,',
  )
  code = replaceOptional(
    code,
    '  const backendContextMatched = costResolvedByBackendContext(cost)',
    '  const backendContextMatched = dholeRuntimeCostResolvedByBackendContext(cost)',
  )
  code = replaceOptional(
    code,
    '    if (!costMatchesHardRouteContext(cost)) return false',
    '    if (!dholeRuntimeCostMatchesHardRouteContext(cost)) return false',
  )
  code = replaceOptional(
    code,
    '    const restoredMixedFclFreight = restorePersistedFclDistribution(rate)',
    '    const restoredMixedFclFreight = dholeRuntimeRestorePersistedFclDistribution(rate)',
  )

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] script end not found.')
  }

  const helpers = `// dhole-runtime-reference-guard-20260925
function dholeRuntimeCostContextImportRateId() {
  const selectedRateId = String(form.selectedImportRateId ?? '').trim()
  if (!selectedRateId) return String(manualOceanFreightSavedId.value ?? '').trim()
  if (!isMultimodalViaPanama(selectedDestination.value)) return ''
  return selectedRateId
}

function dholeRuntimeCostContextPoeId() {
  const manualPoeId = String(manualOceanFreightPoeId.value ?? '').trim()
  if (!form.selectedImportRateId && manualPoeId) return manualPoeId
  if (!isMultimodalViaPanama(selectedDestination.value)) return form.destinationId
  return String(selectedImportRate.value?.poeId ?? '').trim() || form.destinationId
}

function dholeRuntimeCostContextKey() {
  return [
    shipmentModeForApi.value,
    form.originId,
    dholeRuntimeCostContextPoeId(),
    form.podId,
    form.incotermId,
    form.carrierId,
    form.agentId,
    dholeRuntimeCostContextImportRateId(),
    [...form.serviceIds].sort().join(','),
  ].join('|')
}

function dholeRuntimeCostResolvedByBackendContext(cost: CostSelectDto) {
  return String(cost.__dholePricingContextKey ?? '') === dholeRuntimeCostContextKey()
}

function dholeRuntimeCostMatchesHardRouteContext(cost: CostSelectDto) {
  const contextPoeId = dholeRuntimeCostContextPoeId()
  const selectedPodId = String(form.podId ?? '').trim()

  if (cost.polId && cost.polId !== form.originId) return false
  if (cost.poeId && cost.poeId !== contextPoeId) return false
  if (cost.podId && (!selectedPodId || cost.podId !== selectedPodId)) return false

  if (cost.portId) {
    const matchesLegacyPort = cost.portRole === 'Pol'
      ? cost.portId === form.originId
      : cost.portRole === 'Poe'
        ? cost.portId === contextPoeId
        : cost.portRole === 'Pod'
          ? Boolean(selectedPodId) && cost.portId === selectedPodId
          : [form.originId, contextPoeId, selectedPodId].filter(Boolean).includes(cost.portId)
    if (!matchesLegacyPort) return false
  }

  return true
}

function dholeRuntimePersistedFclFreightForContainer(
  rate: RateDto,
  container: { containerTypeName?: string | null; containerTypeCode?: string | null },
  fallbackIndex: number,
) {
  const freight = (rate.rateDetails ?? []).filter((detail) => detail.costDetailType === 'Freight')
  const candidates = [container.containerTypeName, container.containerTypeCode]
    .map((value) => normalizeCatalogValue(String(value ?? '')))
    .filter(Boolean)
  const matched = freight.find((detail) => {
    const source = normalizeCatalogValue(String(detail.name ?? '') + ' ' + String(detail.notes ?? ''))
    return candidates.some((candidate) => source.includes(candidate))
  })
  return matched ?? freight[fallbackIndex] ?? null
}

function dholeRuntimeRestorePersistedFclDistribution(rate: RateDto) {
  if (String(rate.shipmentMode).toLocaleLowerCase() !== 'fcl') return false

  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)
  if (allocations.length <= 1) {
    fclExtraContainers.value = []
    return false
  }

  const primary =
    allocations.find((container) => container.containerTypeId === rate.containerTypeId)
    ?? allocations[0]

  form.equipmentId = primary.containerTypeId
  form.equipmentQuantity = Math.max(1, Math.trunc(number(primary.quantity)))

  const primaryIndex = allocations.findIndex(
    (container) => container.containerTypeId === primary.containerTypeId,
  )
  const primaryFreight = dholeRuntimePersistedFclFreightForContainer(
    rate,
    primary,
    Math.max(0, primaryIndex),
  )
  form.freightCost = number(primaryFreight?.costAmount)
  form.freightSale = number(primaryFreight?.saleAmount)

  fclExtraContainers.value = allocations
    .filter((container) => container.containerTypeId !== primary.containerTypeId)
    .map((container) => {
      const allocationIndex = allocations.findIndex(
        (candidate) => candidate.containerTypeId === container.containerTypeId,
      )
      const freight = dholeRuntimePersistedFclFreightForContainer(
        rate,
        container,
        Math.max(0, allocationIndex),
      )
      return {
        key: crypto.randomUUID(),
        containerTypeId: container.containerTypeId,
        quantity: Math.max(1, Math.trunc(number(container.quantity))),
        freightCostAmount: number(freight?.costAmount),
        freightSaleAmount: number(freight?.saleAmount),
        freightTouched: true,
      }
    })

  return true
}

`

  code = code.slice(0, scriptEnd) + helpers + code.slice(scriptEnd)

  if (code.includes('const contextKey = currentCostContextKey()')) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] currentCostContextKey call remained unresolved.')
  }
  if (code.includes('const restoredMixedFclFreight = restorePersistedFclDistribution(rate)')) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] restorePersistedFclDistribution call remained unresolved.')
  }

  return code
}

export function pricingWizardRuntimeReferenceGuard(): Plugin {
  return {
    name: 'dhole-pricing-wizard-runtime-reference-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
