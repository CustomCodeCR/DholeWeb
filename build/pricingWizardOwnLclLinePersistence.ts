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
    `function isOwnLclMatrixSourceActive() {\n  return shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Own'\n}\n\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  // When an existing LCL rate is opened, hydrateExistingRate() already populated\n  // rateLines from RateDetails returned by the API. Reactive watchers queued while\n  // hydration is finishing must never rebuild that persisted snapshot from the\n  // generic Costs catalog, otherwise Manejos, Zone Charge, CFS, DOC FEE, VGM, etc.\n  // disappear from Pantalla 9 even though the API still returns every detail.\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n\n    // In edit mode keep every persisted row. Only refresh optional catalog costs\n    // around that snapshot; external LCL rows have no costId by design.\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  if (!isOwnLclMatrixSourceActive()) {\n    rebuildRateLines()\n    return\n  }\n\n  // The own-LCL selector already calculated the public commercial lines from the\n  // consolidation Excel matrix. Do not rebuild them from Costos y recargos: doing\n  // so discards Manejos, Zone Charge and the EXW/FCA origin matrix rows.\n  // Remove only previously merged internal catalog costs and merge the current\n  // applicable costs again. Screen 9 / PDF keep showing the Excel lines only.\n  rateLines.value = rateLines.value.filter((line) => !line.costId)\n  mergeConfiguredOptionalCostsIntoRateLines(true)\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // pricingWizardEnhancements already preserves the full selected LCL matrix while
  // advancing from provider to lines. The data was being lost afterwards by these
  // reactive refreshes, which still rebuilt the array from the generic cost catalog.
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
