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
    `function isOwnLclMatrixSourceActive() {\n  return shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Own'\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  // LCL propio tiene una única fuente de cargos: la matriz guardada en el consolidado.\n  // Nunca mezclar Costos y recargos del catálogo general.\n  if (isOwnLclMatrixContext()) {\n    rateLines.value = rateLines.value.filter((line) => !line.costId)\n    return\n  }\n\n  // Para otras fuentes LCL (p. ej. coloader), conservar el comportamiento existente.\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // pricingWizardEnhancements already preserves the selected LCL matrix while
  // advancing from provider to lines. Do not contaminate an own consolidation
  // with fixed/optional rows from the global Costs catalog.
  code = replaceOne(
    code,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n      mergeConfiguredOptionalCostsIntoRateLines(true)\n    } else {\n      rebuildRateLines()\n    }`,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n\n      if (lclSelectedSource.value.kind === 'Own') {\n        rateLines.value = rateLines.value.filter((line) => !line.costId)\n      } else {\n        mergeConfiguredOptionalCostsIntoRateLines(true)\n      }\n    } else {\n      rebuildRateLines()\n    }`,
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

  // Last line of defense: an own-LCL quote may only persist the snapshots
  // returned by the selected consolidation matrix. Global catalog CostId rows
  // must never enter the rate payload.
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
