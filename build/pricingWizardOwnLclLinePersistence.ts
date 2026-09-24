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
    `function isOwnLclMatrixSourceActive() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  if (lclSelectedSource.value?.kind === 'Own') return true\n  return String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction syncOwnLclFreightLineFromProvider() {\n  const source = lclSelectedSource.value\n  if (source?.kind !== 'Own') return\n\n  const cost = number(form.freightCost)\n  const sale = number(form.freightSale)\n  const sourceFreight = source.lines.find((line) => line.costDetailType === 'Freight')\n  if (sourceFreight) {\n    sourceFreight.costAmount = cost\n    sourceFreight.saleAmount = sale\n  }\n\n  const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = cost\n    freight.saleAmount = sale\n  }\n}\n\nfunction persistedOwnLclConsolidationId() {\n  const rate = editingRate.value\n  if (!rate || rate.shipmentMode !== 'Lcl') return ''\n\n  for (const detail of rate.rateDetails ?? []) {\n    const match = String(detail.notes ?? '').match(\n      /ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,\n    )\n    if (match?.[1]) return match[1]\n  }\n\n  return ''\n}\n\nfunction persistedOwnLclContextUnchanged() {\n  const rate = editingRate.value\n  if (!props.rateId || !rate || rate.shipmentMode !== 'Lcl') return false\n\n  const persistedConsolidationId = persistedOwnLclConsolidationId()\n  if (!persistedConsolidationId) return false\n\n  const selectedSourceId =\n    lclSelectedSource.value?.kind === 'Own'\n      ? String(lclSelectedSource.value.id ?? '')\n      : String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n        ? String(lclSelectedSourceKey.value).slice(4)\n        : ''\n\n  if (selectedSourceId && selectedSourceId !== persistedConsolidationId) return false\n\n  return String(rate.polId ?? '') === String(form.originId ?? '')\n    && String(rate.poeId ?? '') === String(form.destinationId ?? '')\n    && String(rate.podId ?? '') === String(form.podId ?? '')\n    && String(rate.carrierId ?? '') === String(form.carrierId ?? '')\n    && String(rate.agentId ?? '') === String(form.agentId ?? '')\n}\n\nfunction persistedOwnLclRateLine(detail: RateDto['rateDetails'][number]): RateLine {\n  const normalizedName = normalizeCatalogValue(detail.name)\n  const isPickup = /pickup|recole/.test(normalizedName)\n  const detailType: CostDetailType = isPickup ? 'OriginCharge' : detail.costDetailType\n  const chargeBasis: ChargeBasis = normalizedName === 'cfs' ? 'PerCbm' : detail.chargeBasis\n\n  return {\n    key: \`existing:\${detail.id}\`,\n    detailId: detail.id,\n    section: isPickup ? 'pickup_origin' : sectionForDetail(detailType, detail.name),\n    name: detail.name,\n    costDetailType: detailType,\n    costType: detail.costType,\n    chargeBasis,\n    costId: null,\n    notes: detail.notes ?? null,\n    billToClient: detail.billToClient ?? null,\n    currencyId: detail.currencyId,\n    currencyName: detail.currencyName,\n    currencyCode: detail.currencyCode,\n    amountCurrencyCode: detail.currencyCode,\n    costAmount: Number(detail.costAmount || 0),\n    saleAmount: Number(detail.saleAmount || 0),\n    included: true,\n    optional: false,\n    manual: true,\n    applyDestinationTax:\n      Boolean(detail.applyDestinationTax) || /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),\n    destinationTaxRate: Number(detail.destinationTaxRate || 0),\n  } as RateLine\n}\n\nfunction normalizeOwnLclSourceLine(line: RateLine) {\n  const normalizedName = normalizeCatalogValue(line.name)\n  const isPickup = /pickup|recole/.test(normalizedName)\n\n  return {\n    ...line,\n    section: isPickup ? 'pickup_origin' : line.section,\n    costDetailType: isPickup ? 'OriginCharge' : line.costDetailType,\n    chargeBasis: normalizedName === 'cfs' ? 'PerCbm' : line.chargeBasis,\n    costId: null,\n    included: true,\n    optional: false,\n  } as RateLine\n}\n\nfunction restoreOwnLclMatrixLines() {\n  // Existing own-LCL edits are snapshot-based. If route/provider and consolidation\n  // did not change, Pantalla 7 must keep exactly the persisted RateDetails.\n  if (persistedOwnLclContextUnchanged() && editingRate.value) {\n    rateLines.value = editingRate.value.rateDetails.map(persistedOwnLclRateLine)\n    costs.value = []\n    return\n  }\n\n  const source = lclSelectedSource.value\n  if (source?.kind === 'Own' && Array.isArray(source.lines) && source.lines.length) {\n    rateLines.value = source.lines.map((line) =>\n      normalizeOwnLclSourceLine(line as RateLine),\n    )\n    syncOwnLclFreightLineFromProvider()\n  } else {\n    rateLines.value = rateLines.value.filter((line) => !line.costId)\n  }\n  costs.value = []\n}\n\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n\n  // Consolidado propio: la única fuente de líneas es la matriz guardada en el consolidado.\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
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
