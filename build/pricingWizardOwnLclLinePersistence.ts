import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardOwnLclLinePersistence] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `function addManualCharge() {`,
    `function isOwnLclMatrixSourceActive() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  if (lclSelectedSource.value?.kind === 'Own') return true\n  return String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction restoreOwnLclMatrixLines() {\n  const source = lclSelectedSource.value\n  if (source?.kind === 'Own' && Array.isArray(source.lines) && source.lines.length) {\n    rateLines.value = source.lines.map((line) => ({\n      ...line,\n      costId: null,\n      included: true,\n      optional: false,\n    })) as RateLine[]\n  } else {\n    rateLines.value = rateLines.value.filter((line) => !line.costId)\n  }\n  costs.value = []\n}\n\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n\n  // Consolidado propio: la única fuente de líneas es la matriz guardada en el consolidado.\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // Never query the global Costs catalog for an own consolidation.
  code = replaceOne(
    code,
    `async function loadApplicableCosts() {\n  try {`,
    `async function loadApplicableCosts() {\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return\n  }\n\n  try {`,
    'own LCL applicable costs guard',
  )

  // Any watcher that tries to rebuild lines while Own is selected must restore
  // the consolidation calculation instead of rebuilding from Costs y recargos.
  code = replaceOne(
    code,
    `function rebuildRateLines() {\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    `function rebuildRateLines() {\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    'own LCL rebuild guard',
  )

  code = replaceOne(
    code,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
    'own LCL merge guard',
  )

  code = replaceOne(
    code,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n      mergeConfiguredOptionalCostsIntoRateLines(true)\n    } else {\n      rebuildRateLines()\n    }`,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n\n      if (lclSelectedSource.value.kind === 'Own') {\n        restoreOwnLclMatrixLines()\n      } else {\n        mergeConfiguredOptionalCostsIntoRateLines(true)\n      }\n    } else {\n      rebuildRateLines()\n    }`,
    'provider-to-lines own LCL guard',
  )

  code = replaceOne(
    code,
    `    await loadApplicableCosts()\n    if (step.value >= 7) rebuildRateLines()`,
    `    await loadApplicableCosts()\n    if (step.value >= 7) refreshRateLinesForCurrentSource()`,
    'agent/carrier line refresh',
  )

  code = replaceOne(
    code,
    `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`,
    `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) refreshRateLinesForCurrentSource()\n})`,
    'currency line refresh',
  )

  code = replaceOne(
    code,
    `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|')] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    rebuildRateLines()\n  },\n)`,
    `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|')] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    refreshRateLinesForCurrentSource()\n  },\n)`,
    'cargo/service line refresh',
  )

  code = replaceOne(
    code,
    `          <div class="crystal-bottom-charges space-y-4 p-4">`,
    `          <div v-if="!isOwnLclMatrixContext()" class="crystal-bottom-charges space-y-4 p-4">`,
    'hide global optional/manual charges for own LCL',
  )

  // Last line of defense: Own may only persist matrix snapshots (costId=null).
  code = replaceOne(
    code,
    `  const details: CreateRateDetailRequest[] = includedLines.value.map((line) => ({`,
    `  const sourceDetails = isOwnLclMatrixContext()\n    ? includedLines.value.filter((line) => !line.costId)\n    : includedLines.value\n  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({`,
    'own LCL persisted detail guard',
  )

  return code
}

export function pricingWizardOwnLclLinePersistence(): Plugin {
  return {
    name: 'dhole-pricing-wizard-own-lcl-line-persistence',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
