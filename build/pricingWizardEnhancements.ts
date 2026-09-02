import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardEnhancements] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function replaceMany(
  source: string,
  anchor: string,
  replacement: string,
  expectedOccurrences: number,
  label: string,
) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== expectedOccurrences) {
    throw new Error(`[pricingWizardEnhancements] Expected ${expectedOccurrences} ${label} anchors, found ${occurrences}.`)
  }
  return source.split(anchor).join(replacement)
}

export function pricingWizardEnhancements(): Plugin {
  return {
    name: 'dhole-pricing-wizard-enhancements',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId?.endsWith(WIZARD_PATH)) return null

      let code = source

      const importAnchor = "import PricingEmailSourceModal from '@/modules/pricing/components/PricingEmailSourceModal.vue'"
      code = replaceOne(
        code,
        importAnchor,
        `${importAnchor}\nimport PricingCommercialTermsSelector, { type CommercialTermsSelection } from '@/modules/pricing/components/PricingCommercialTermsSelector.vue'\nimport PricingLclRateSourceSelector, { type LclRateSourceSelection } from '@/modules/pricing/components/PricingLclRateSourceSelector.vue'`,
        'wizard component imports',
      )

      const stateAnchor = 'const downloadingQuote = ref(false)'
      code = replaceOne(
        code,
        stateAnchor,
        `${stateAnchor}\nconst lclSelectedSourceKey = ref('')\nconst lclRequestedCbm = ref(1)\nconst lclSelectedSource = ref<LclRateSourceSelection | null>(null)\nconst draftCommercialTerms = ref<CommercialTermsSelection>({ includes: [], subjectTo: [], excludes: [] })\nconst draftCommercialTermsInitialized = ref(false)`,
        'LCL and commercial terms state',
      )

      const warehouseAnchor = "const selectedWarehouse = computed(() => findById(catalogs.warehouses, form.warehouseId))"
      code = replaceOne(
        code,
        warehouseAnchor,
        `${warehouseAnchor}\n\nfunction warehousePolCodes(warehouse: CatalogItemSelectDto) {\n  const meta = metadata(warehouse) as (CatalogMetadata & { polCodes?: string[] }) | null\n  return Array.isArray(meta?.polCodes) ? meta.polCodes : []\n}\n\nfunction resolveWarehouseForOriginPol() {\n  const origin = selectedOrigin.value\n  if (!origin) return null\n  const polCode = String(origin.code || displayValue(origin) || '').trim()\n  if (!polCode) return null\n  const normalizedPol = normalizeCatalogValue(polCode)\n  const expectedWarehouseCode = normalizeCatalogValue('WHS_' + polCode)\n  return catalogs.warehouses.find((warehouse) => {\n    const warehouseCode = normalizeCatalogValue(String(warehouse.code || ''))\n    if (warehouseCode === expectedWarehouseCode) return true\n    return warehousePolCodes(warehouse).some((candidate) => normalizeCatalogValue(String(candidate)) === normalizedPol)\n  }) ?? null\n}\n\nasync function applyAutomaticFobWarehouse() {\n  if (selectedIncotermCode.value !== 'FOB') return\n  const warehouse = resolveWarehouseForOriginPol()\n  if (!warehouse) {\n    form.warehouseId = ''\n    form.pickupAddress = ''\n    form.pickupLatitude = null\n    form.pickupLongitude = null\n    return\n  }\n  form.warehouseId = warehouse.id\n  await applySelectedWarehouse()\n}`,
        'FOB warehouse resolver',
      )

      const quantityAnchor = `function quantityForChargeBasis(basis: ChargeBasis) {\n  if (basis === 'PerContainer' || basis === 'PerTruck') {\n    return Math.max(1, form.equipmentQuantity)\n  }\n  if (basis === 'PerTeu') {\n    const equipment = \`${'${selectedEquipment.value?.code ?? \'\'} ${displayValue(selectedEquipment.value)}'}\`\n    const multiplier = /(^|\\D)20(\\D|$)/.test(equipment) ? 1 : 2\n    return Math.max(1, form.equipmentQuantity) * multiplier\n  }\n  return 1\n}`
      const quantityReplacement = `function quantityForChargeBasis(basis: ChargeBasis) {\n  if (basis === 'PerContainer' || basis === 'PerTruck') {\n    return Math.max(1, form.equipmentQuantity)\n  }\n  if (basis === 'PerTeu') {\n    const equipment = \`${'${selectedEquipment.value?.code ?? \'\'} ${displayValue(selectedEquipment.value)}'}\`\n    const multiplier = /(^|\\D)20(\\D|$)/.test(equipment) ? 1 : 2\n    return Math.max(1, form.equipmentQuantity) * multiplier\n  }\n  if ((basis === 'PerCbm' || basis === 'PerChargeableCbm') && shipmentModeForApi.value === 'Lcl') {\n    return Math.max(1, number(lclChargeableCbm.value))\n  }\n  return 1\n}`
      code = replaceOne(code, quantityAnchor, quantityReplacement, 'LCL chargeable CBM quantity')

      const canNextAnchor = `  if (step.value === 4) return true\n  if (step.value === 5) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)\n  if (step.value === 6) return Boolean(form.agentId && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)`
      const canNextReplacement = `  if (step.value === 4) {\n    if (shipmentModeForApi.value !== 'Lcl') return true\n    return Boolean(\n      form.cargoPallets > 0 &&\n      form.cargoWeightKg > 0 &&\n      form.cargoLengthCm > 0 &&\n      form.cargoWidthCm > 0 &&\n      form.cargoHeightCm > 0 &&\n      lclChargeableCbm.value > 0\n    )\n  }\n  if (step.value === 5) {\n    if (shipmentModeForApi.value === 'Lcl') return Boolean(lclSelectedSource.value)\n    return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)\n  }\n  if (step.value === 6) {\n    const providerReady = shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value ? true : Boolean(form.agentId)\n    return Boolean(providerReady && form.carrierId && form.currencyId && form.freightCost >= 0 && form.freightSale >= 0)\n  }`
      code = replaceOne(code, canNextAnchor, canNextReplacement, 'wizard LCL next validation')

      const searchRatesAnchor = `  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    form.manualRate = true\n    return\n  }`
      const searchRatesReplacement = `  if (shipmentModeForApi.value === 'Lcl') {\n    return\n  }\n\n  if (shipmentModeForApi.value !== 'Fcl' || !selectedOrigin.value || !selectedDestination.value || !selectedEquipment.value) {\n    form.manualRate = true\n    return\n  }`
      code = replaceOne(code, searchRatesAnchor, searchRatesReplacement, 'LCL source search bypass')

      const helperAnchor = 'async function saveRate() {'
      const helperCode = `function uniqueCommercialTerms(values: Array<string | null | undefined>) {\n  const seen = new Set<string>()\n  const result: string[] = []\n  values.forEach((value) => {\n    String(value ?? '')\n      .split(/\\r?\\n|,/g)\n      .map((item) => item.trim())\n      .filter(Boolean)\n      .forEach((text) => {\n        const key = commercialTermKey(text) || normalizeCatalogValue(text)\n        if (!key || seen.has(key)) return\n        seen.add(key)\n        result.push(text)\n      })\n  })\n  return result\n}\n\nfunction applyLclRateSource(selection: LclRateSourceSelection) {\n  lclSelectedSource.value = selection\n  lclSelectedSourceKey.value = \`${'${selection.kind}:${selection.id}'}\`\n  lclRequestedCbm.value = Math.max(1, number(selection.requestedCbm))\n  form.selectedImportRateId = ''\n  form.manualRate = false\n  form.agentId = selection.providerId ?? ''\n  if (selection.carrierId) form.carrierId = selection.carrierId\n  if (selection.currencyId) form.currencyId = selection.currencyId\n  form.freeDays = number(selection.freeDays)\n  form.transitDays = number(selection.transitDays)\n  const freight = selection.lines.find((line) => line.costDetailType === 'Freight')\n  form.freightCost = number(freight?.costAmount)\n  form.freightSale = number(freight?.saleAmount)\n  rateLines.value = selection.lines.map((line) => ({ ...line })) as RateLine[]\n  draftCommercialTermsInitialized.value = false\n}\n\nasync function initializeDraftCommercialTerms() {\n  if (editingRate.value) {\n    draftCommercialTerms.value = {\n      includes: uniqueCommercialTerms([editingRate.value.includes]),\n      subjectTo: uniqueCommercialTerms([editingRate.value.subjectTo]),\n      excludes: uniqueCommercialTerms([editingRate.value.excludes]),\n    }\n    draftCommercialTermsInitialized.value = true\n    return\n  }\n\n  const origin = selectedOrigin.value\n  const poe = selectedDestination.value\n  const pod = resolvePodForDestination()\n  const incoterm = selectedIncoterm.value\n  if (!origin || !poe || !incoterm) {\n    draftCommercialTerms.value = { includes: [], subjectTo: [], excludes: [] }\n    draftCommercialTermsInitialized.value = true\n    return\n  }\n\n  const serviceCodes = selectedServices.value\n    .map((service) => String(service.code ?? '').trim().toUpperCase())\n    .filter(Boolean)\n  if (form.dangerousCargo) serviceCodes.push('DANGEROUS_CARGO')\n  if (form.overweight) serviceCodes.push('OVERWEIGHT')\n\n  const commercialTerms = await resolveCommercialTerms({\n    transportModality: form.modality as Modality,\n    shipmentMode: shipmentModeForApi.value,\n    direction: direction.value,\n    incotermId: incoterm.id,\n    incotermCode: incoterm.code,\n    serviceCodes,\n    routeText: [displayValue(origin), displayValue(poe), displayValue(pod)].filter(Boolean).join(' '),\n  })\n\n  const source = lclSelectedSource.value\n  const includes = uniqueCommercialTerms([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...(source?.includes ?? []),\n  ])\n  const includeKeys = new Set(includes.map((text) => commercialTermKey(text) || normalizeCatalogValue(text)))\n  const subjectTo = uniqueCommercialTerms([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    ...(source?.subjectTo ?? []),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text) || normalizeCatalogValue(text)))\n  const subjectKeys = new Set(subjectTo.map((text) => commercialTermKey(text) || normalizeCatalogValue(text)))\n  const excludes = uniqueCommercialTerms([\n    ...commercialTerms.excludes.map((item) => item.text),\n    ...(source?.excludes ?? []),\n  ]).filter((text) => {\n    const key = commercialTermKey(text) || normalizeCatalogValue(text)\n    return !includeKeys.has(key) && !subjectKeys.has(key)\n  })\n\n  draftCommercialTerms.value = { includes, subjectTo, excludes }\n  draftCommercialTermsInitialized.value = true\n}\n\n`
      code = replaceOne(code, helperAnchor, helperCode + helperAnchor, 'LCL source and commercial term helpers')

      const includeTermsAnchor = `  const includeTerms = uniqueTermLines([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...includedLines.value.map((line) => line.name),\n  ])`
      const includeTermsReplacement = `  const includeTerms = uniqueTermLines([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...(lclSelectedSource.value?.includes ?? []),\n  ])`
      code = replaceOne(code, includeTermsAnchor, includeTermsReplacement, 'commercial includes without tariff line names')

      const subjectTermsAnchor = `  const subjectTerms = uniqueTermLines([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text)))`
      const subjectTermsReplacement = `  const subjectTerms = uniqueTermLines([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    ...(lclSelectedSource.value?.subjectTo ?? []),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text)))`
      code = replaceOne(code, subjectTermsAnchor, subjectTermsReplacement, 'commercial subject terms')

      const excludeTermsAnchor = `  const excludeTerms = uniqueTermLines(\n    commercialTerms.excludes.map((item) => item.text),\n  ).filter((text) => {`
      const excludeTermsReplacement = `  const excludeTerms = uniqueTermLines([\n    ...commercialTerms.excludes.map((item) => item.text),\n    ...(lclSelectedSource.value?.excludes ?? []),\n  ]).filter((text) => {`
      code = replaceOne(code, excludeTermsAnchor, excludeTermsReplacement, 'commercial excludes')

      const missingAgentAnchor = `  if (!agent) missing.push('agente')\n  if (!carrier) missing.push('proveedor')`
      const missingAgentReplacement = `  if (!agent && !(shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value)) missing.push('agente')\n  if (!carrier) missing.push('proveedor')`
      code = replaceOne(code, missingAgentAnchor, missingAgentReplacement, 'own LCL nullable agent validation')

      const createAgentAnchor = `      agentId: agent!.id,\n      agentName: displayValue(agent),\n      agentCode: agent!.code,`
      const createAgentReplacement = `      agentId: agent?.id ?? null,\n      agentName: agent ? displayValue(agent) : lclSelectedSource.value?.providerName ?? null,\n      agentCode: agent?.code ?? lclSelectedSource.value?.providerCode ?? null,`
      code = replaceOne(code, createAgentAnchor, createAgentReplacement, 'create payload nullable agent')

      const updateAgentAnchor = `        agentId: agent!.id,\n        agentName: displayValue(agent),\n        agentCode: agent!.code,`
      const updateAgentReplacement = `        agentId: agent?.id ?? null,\n        agentName: agent ? displayValue(agent) : lclSelectedSource.value?.providerName ?? null,\n        agentCode: agent?.code ?? lclSelectedSource.value?.providerCode ?? null,`
      code = replaceOne(code, updateAgentAnchor, updateAgentReplacement, 'update payload nullable agent')

      const persistedTermsAnchor = `      includes: includeTerms.join('\\n') || null,\n      subjectTo: subjectTerms.join('\\n') || null,\n      excludes: excludeTerms.join('\\n') || null,`
      const persistedTermsReplacement = `      includes: (draftCommercialTermsInitialized.value ? draftCommercialTerms.value.includes : includeTerms).join('\\n') || null,\n      subjectTo: (draftCommercialTermsInitialized.value ? draftCommercialTerms.value.subjectTo : subjectTerms).join('\\n') || null,\n      excludes: (draftCommercialTermsInitialized.value ? draftCommercialTerms.value.excludes : excludeTerms).join('\\n') || null,`
      code = replaceOne(code, persistedTermsAnchor, persistedTermsReplacement, 'catalog-selected commercial term persistence')

      const cargoPersistenceAnchor = `      totalPackages: 0,\n      totalPallets: 0,\n      totalWeightKg: 0,\n      totalVolumeCbm: 0,\n      cargoLines: form.cargoDescription`
      const cargoPersistenceReplacement = `      totalPackages: shipmentModeForApi.value === 'Lcl' ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,\n      totalPallets: shipmentModeForApi.value === 'Lcl' ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,\n      totalWeightKg: shipmentModeForApi.value === 'Lcl' ? Math.max(0, number(form.cargoWeightKg)) : 0,\n      totalVolumeCbm: shipmentModeForApi.value === 'Lcl' ? lclDimensionalCbm.value : 0,\n      kgPerCbm: shipmentModeForApi.value === 'Lcl' ? 500 : undefined,\n      cargoLines: form.cargoDescription || shipmentModeForApi.value === 'Lcl'`
      code = replaceOne(code, cargoPersistenceAnchor, cargoPersistenceReplacement, 'LCL cargo persistence')

      const cargoLineAnchor = `            packages: 0,\n            pallets: 0,\n            weightKg: 0,\n            lengthCm: 0,\n            widthCm: 0,\n            heightCm: 0,`
      const cargoLineReplacement = `            packages: shipmentModeForApi.value === 'Lcl' ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,\n            pallets: shipmentModeForApi.value === 'Lcl' ? Math.max(1, Math.trunc(number(form.cargoPallets))) : 0,\n            weightKg: shipmentModeForApi.value === 'Lcl' ? Math.max(0, number(form.cargoWeightKg)) : 0,\n            lengthCm: shipmentModeForApi.value === 'Lcl' ? Math.max(0, number(form.cargoLengthCm)) : 0,\n            widthCm: shipmentModeForApi.value === 'Lcl' ? Math.max(0, number(form.cargoWidthCm)) : 0,\n            heightCm: shipmentModeForApi.value === 'Lcl' ? Math.max(0, number(form.cargoHeightCm)) : 0,`
      code = replaceOne(code, cargoLineAnchor, cargoLineReplacement, 'LCL cargo line dimensions')

      code = replaceMany(
        code,
        "pickupAddress: ['EXW', 'FCA'].includes(selectedIncotermCode.value)",
        "pickupAddress: ['EXW', 'FCA', 'FOB'].includes(selectedIncotermCode.value)",
        2,
        'FOB pickup address persistence',
      )
      code = replaceOne(
        code,
        "pickupLatitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value)",
        "pickupLatitude: ['EXW', 'FCA', 'FOB'].includes(selectedIncotermCode.value)",
        'FOB pickup latitude persistence',
      )
      code = replaceOne(
        code,
        "pickupLongitude: ['EXW', 'FCA'].includes(selectedIncotermCode.value)",
        "pickupLongitude: ['EXW', 'FCA', 'FOB'].includes(selectedIncotermCode.value)",
        'FOB pickup longitude persistence',
      )

      const nextAnchor = `  if (!canNext.value) return\n  if (step.value === 4) await searchApprovedRates()\n  if (step.value === 6) {\n    await loadApplicableCosts()\n    rebuildRateLines()\n  }\n  if (step.value < 8) step.value += 1`
      const nextReplacement = `  if (!canNext.value) return\n  if (step.value === 4) await searchApprovedRates()\n  if (step.value === 6) {\n    await loadApplicableCosts()\n    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n      mergeConfiguredOptionalCostsIntoRateLines(true)\n    } else {\n      rebuildRateLines()\n    }\n  }\n  if (step.value < 8) step.value += 1`
      code = replaceOne(code, nextAnchor, nextReplacement, 'LCL line preservation while advancing')

      const resetAnchor = `  availableRates.value = []\n  rateLines.value = []\n  supportEntityId.value = crypto.randomUUID()`
      const resetReplacement = `  availableRates.value = []\n  rateLines.value = []\n  lclSelectedSourceKey.value = ''\n  lclRequestedCbm.value = 1\n  lclSelectedSource.value = null\n  draftCommercialTerms.value = { includes: [], subjectTo: [], excludes: [] }\n  draftCommercialTermsInitialized.value = false\n  supportEntityId.value = crypto.randomUUID()`
      code = replaceOne(code, resetAnchor, resetReplacement, 'LCL wizard reset')

      const incotermWatchAnchor = `watch(\n  () => selectedIncotermCode.value,\n  (code) => {\n    nearestPortRecommendations.value = []\n    if (code !== 'FCA') form.warehouseId = ''\n    if (code !== 'EXW' && code !== 'FCA') {\n      form.pickupAddress = ''\n      form.pickupLatitude = null\n      form.pickupLongitude = null\n    }\n  },\n)\n\nwatch(\n  () => form.warehouseId,\n  () => {\n    if (selectedIncotermCode.value === 'FCA') void applySelectedWarehouse()\n  },\n)`
      const incotermWatchReplacement = `watch(\n  () => selectedIncotermCode.value,\n  (code) => {\n    nearestPortRecommendations.value = []\n    draftCommercialTermsInitialized.value = false\n    lclSelectedSource.value = null\n    lclSelectedSourceKey.value = ''\n    if (code === 'FOB') {\n      void applyAutomaticFobWarehouse()\n      return\n    }\n    if (code !== 'FCA') form.warehouseId = ''\n    if (code !== 'EXW' && code !== 'FCA') {\n      form.pickupAddress = ''\n      form.pickupLatitude = null\n      form.pickupLongitude = null\n    }\n  },\n)\n\nwatch(\n  () => form.originId,\n  () => {\n    draftCommercialTermsInitialized.value = false\n    lclSelectedSource.value = null\n    lclSelectedSourceKey.value = ''\n    if (selectedIncotermCode.value === 'FOB') void applyAutomaticFobWarehouse()\n  },\n)\n\nwatch(\n  () => form.destinationId,\n  () => {\n    lclSelectedSource.value = null\n    lclSelectedSourceKey.value = ''\n  },\n)\n\nwatch(\n  () => form.warehouseId,\n  () => {\n    if (selectedIncotermCode.value === 'FCA') void applySelectedWarehouse()\n  },\n)`
      code = replaceOne(code, incotermWatchAnchor, incotermWatchReplacement, 'route and Incoterm source reset watchers')

      const stepWatchAnchor = `watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n})`
      const stepWatchReplacement = `watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n  if (value === 8) {\n    void initializeDraftCommercialTerms().catch(() => {\n      draftCommercialTerms.value = { includes: [], subjectTo: [], excludes: [] }\n      draftCommercialTermsInitialized.value = true\n    })\n  }\n})`
      code = replaceOne(code, stepWatchAnchor, stepWatchReplacement, 'Pantalla 8 commercial terms initializer')

      const routeSummaryAnchor = '          <div v-if="selectedEquipment || direction" class="crystal-route-summary">'
      const fobCard = `          <div v-if="selectedIncotermCode === 'FOB'" class="crystal-soft p-4">\n            <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">WHS automático por POL</p>\n            <template v-if="selectedWarehouse">\n              <p class="mt-2 text-sm font-black">{{ selectedWarehouse.label || displayValue(selectedWarehouse) || selectedWarehouse.code }}</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ form.pickupAddress || 'Dirección configurada en el catálogo del WHS.' }}</p>\n              <p class="mt-2 text-[11px] font-bold text-[var(--dh-primary)]">FOB resuelve este WHS automáticamente a partir del POL seleccionado.</p>\n            </template>\n            <p v-else class="mt-2 text-xs font-bold text-amber-600">No existe un WHS asociado a este POL. Configure el WHS en Config.</p>\n          </div>\n\n`
      code = replaceOne(code, routeSummaryAnchor, fobCard + routeSummaryAnchor, 'FOB warehouse visual card')

      const step5TitleAnchor = `            <h2 class="crystal-title">Tarifas pre-aprobadas disponibles</h2>\n            <p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>`
      const step5TitleReplacement = `            <h2 class="crystal-title">{{ shipmentModeForApi === 'Lcl' ? 'Seleccione la fuente tarifaria LCL' : 'Tarifas pre-aprobadas disponibles' }}</h2>\n            <p class="crystal-description">{{ shipmentModeForApi === 'Lcl' ? 'Compare consolidados propios y tarifarios de coloader. Al seleccionar una fuente, sus líneas reales pasan a Pantalla 7.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`
      code = replaceOne(code, step5TitleAnchor, step5TitleReplacement, 'Pantalla 5 LCL title')

      const loadingRatesAnchor = `          <div v-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>`
      const lclSelector = `          <PricingLclRateSourceSelector\n            v-if="shipmentModeForApi === 'Lcl'"\n            v-model="lclSelectedSourceKey"\n            :requested-cbm="lclChargeableCbm"\n            :requested-cbm-locked="true"\n            :cargo-lines="lclCargoLines"\n            :pol-id="selectedOrigin?.id ?? null"\n            :pol-code="selectedOrigin?.code ?? null"\n            :poe-id="selectedDestination?.id ?? null"\n            :pod-id="selectedPod?.id ?? null"\n            :incoterm-id="selectedIncoterm?.id ?? null"\n            :incoterm-code="selectedIncotermCode"\n            :destination-label="displayValue(resolvePodForDestination() ?? selectedDestination)"\n            :quote-date="form.loadDate"\n            :currency-id="selectedCurrency?.id ?? form.currencyId"\n            :currency-name="displayValue(selectedCurrency) || 'USD'"\n            :currency-code="selectedCurrency?.code ?? 'USD'"\n            @select="applyLclRateSource"\n          />\n\n          <div v-else-if="loadingRates" class="py-14 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Buscando tarifas vigentes…</div>`
      code = replaceOne(code, loadingRatesAnchor, lclSelector, 'Pantalla 5 LCL tariff source selector')

      const manualNoteAnchor = '<div v-if="form.manualRate && availableRates.length" class="crystal-soft px-4 py-3 text-sm font-bold">'
      code = replaceOne(
        code,
        manualNoteAnchor,
        '<div v-if="shipmentModeForApi !== \'Lcl\' && form.manualRate && availableRates.length" class="crystal-soft px-4 py-3 text-sm font-bold">',
        'manual rate note hidden for LCL',
      )

      const providerAgentAnchor = '            <DhSelect v-model="form.agentId" label="Agente" :options="agentOptions" />'
      const providerAgentReplacement = `            <DhInput v-if="shipmentModeForApi === 'Lcl' && lclSelectedSource?.kind === 'Own'" :model-value="lclSelectedSource.providerName || 'Grupo Castro Fallas'" label="Fuente / proveedor" disabled />\n            <DhSelect v-else v-model="form.agentId" label="Agente / coloader" :options="agentOptions" />`
      code = replaceOne(code, providerAgentAnchor, providerAgentReplacement, 'LCL provider field')

      const freightCostAnchor = '            <DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" />'
      const freightCostReplacement = '            <DhInput v-model.number="form.freightCost" type="number" min="0" step="0.01" label="Flete internacional · costo" :disabled="shipmentModeForApi === \'Lcl\' && Boolean(lclSelectedSource)" />'
      code = replaceOne(code, freightCostAnchor, freightCostReplacement, 'LCL source cost locking')

      const step8CloseAnchor = `          </div>\n        </div>\n\n        <div v-else-if="step === 9 && viewOnly && editingRate" class="space-y-6">`
      const termsBoard = `          </div>\n\n          <section class="crystal-soft p-5">\n            <PricingCommercialTermsSelector v-model="draftCommercialTerms" :disabled="viewOnly" />\n          </section>\n        </div>\n\n        <div v-else-if="step === 9 && viewOnly && editingRate" class="space-y-6">`
      code = replaceOne(code, step8CloseAnchor, termsBoard, 'Pantalla 8 drag and drop commercial terms')

      return { code, map: null }
    },
  }
}
