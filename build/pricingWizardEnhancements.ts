import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardEnhancements] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingWizardEnhancements(): Plugin {
  return {
    name: 'dhole-pricing-wizard-enhancements',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId?.endsWith(WIZARD_PATH)) return null

      let code = source

      const stateAnchor = "const downloadingQuote = ref(false)"
      code = replaceOne(
        code,
        stateAnchor,
        `${stateAnchor}\nconst draftIncludes = ref('')\nconst draftSubjectTo = ref('')\nconst draftExcludes = ref('')\nconst draftCommercialTermsInitialized = ref(false)`,
        'draft commercial terms state',
      )

      const warehouseAnchor = "const selectedWarehouse = computed(() => findById(catalogs.warehouses, form.warehouseId))"
      code = replaceOne(
        code,
        warehouseAnchor,
        `${warehouseAnchor}\n\nfunction warehousePolCodes(warehouse: CatalogItemSelectDto) {\n  const meta = metadata(warehouse) as (CatalogMetadata & { polCodes?: string[] }) | null\n  return Array.isArray(meta?.polCodes) ? meta.polCodes : []\n}\n\nfunction resolveWarehouseForOriginPol() {\n  const origin = selectedOrigin.value\n  if (!origin) return null\n\n  const polCode = String(origin.code || displayValue(origin) || '').trim()\n  if (!polCode) return null\n\n  const normalizedPol = normalizeCatalogValue(polCode)\n  const expectedWarehouseCode = normalizeCatalogValue('WHS_' + polCode)\n\n  return catalogs.warehouses.find((warehouse) => {\n    const warehouseCode = normalizeCatalogValue(String(warehouse.code || ''))\n    if (warehouseCode === expectedWarehouseCode) return true\n    return warehousePolCodes(warehouse).some((candidate) =>\n      normalizeCatalogValue(String(candidate)) === normalizedPol,\n    )\n  }) ?? null\n}\n\nasync function applyAutomaticFobWarehouse() {\n  if (selectedIncotermCode.value !== 'FOB') return\n\n  const warehouse = resolveWarehouseForOriginPol()\n  if (!warehouse) {\n    form.warehouseId = ''\n    form.pickupAddress = ''\n    form.pickupLatitude = null\n    form.pickupLongitude = null\n    return\n  }\n\n  form.warehouseId = warehouse.id\n  await applySelectedWarehouse()\n}`,
        'FOB warehouse helper',
      )

      const termsHelperAnchor = 'async function saveRate() {'
      const termsHelpers = `function draftTermsForEditor(value?: string | null) {\n  const seen = new Set<string>()\n  return String(value ?? '')\n    .split(/\\r\\n|\\n|\\r|,/g)\n    .map((item) => item.trim())\n    .filter((item) => {\n      if (!item) return false\n      const key = commercialTermKey(item)\n      if (!key || seen.has(key)) return false\n      seen.add(key)\n      return true\n    })\n    .join(', ')\n}\n\nfunction draftTermsForSave(value: string) {\n  const seen = new Set<string>()\n  const values = String(value ?? '')\n    .split(/\\r\\n|\\n|\\r|,/g)\n    .map((item) => item.trim())\n    .filter((item) => {\n      if (!item) return false\n      const key = commercialTermKey(item)\n      if (!key || seen.has(key)) return false\n      seen.add(key)\n      return true\n    })\n  return values.length ? values.join('\\n') : null\n}\n\nasync function initializeDraftCommercialTerms() {\n  draftCommercialTermsInitialized.value = false\n\n  if (editingRate.value) {\n    draftIncludes.value = draftTermsForEditor(editingRate.value.includes)\n    draftSubjectTo.value = draftTermsForEditor(editingRate.value.subjectTo)\n    draftExcludes.value = draftTermsForEditor(editingRate.value.excludes)\n    draftCommercialTermsInitialized.value = true\n    return\n  }\n\n  const origin = selectedOrigin.value\n  const poe = selectedDestination.value\n  const pod = resolvePodForDestination()\n  const incoterm = selectedIncoterm.value\n  if (!origin || !poe || !incoterm) {\n    draftIncludes.value = ''\n    draftSubjectTo.value = ''\n    draftExcludes.value = ''\n    draftCommercialTermsInitialized.value = true\n    return\n  }\n\n  const includedNameKeys = new Set(\n    includedLines.value.map((line) => normalizeCatalogValue(line.name)),\n  )\n  const serviceCodes = new Set<string>()\n  selectedServices.value.forEach((service) => {\n    const code = service.code?.trim().toUpperCase()\n    if (!code) return\n    const canonical = canonicalServiceLine(code, displayValue(service))\n    if (\n      Boolean(metadata(service)?.optional) &&\n      !includedNameKeys.has(normalizeCatalogValue(canonical.name))\n    ) return\n    serviceCodes.add(code)\n  })\n\n  if (!incotermBuyerPaysMainTransport(incoterm.code)) serviceCodes.delete('INT_TRANSPORT')\n  if (includedLines.value.some((line) => line.costDetailType === 'Insurance'))\n    serviceCodes.add('CARGO_INSURANCE')\n  else\n    serviceCodes.delete('CARGO_INSURANCE')\n  if (form.dangerousCargo) serviceCodes.add('DANGEROUS_CARGO')\n  if (form.overweight) serviceCodes.add('OVERWEIGHT')\n\n  const commercialTerms = await resolveCommercialTerms({\n    transportModality: form.modality as Modality,\n    shipmentMode: shipmentModeForApi.value,\n    direction: direction.value,\n    incotermId: incoterm.id,\n    incotermCode: incoterm.code,\n    serviceCodes: [...serviceCodes],\n    routeText: [displayValue(origin), displayValue(poe), displayValue(pod)]\n      .filter(Boolean)\n      .join(' '),\n  })\n\n  const unique = (values: Array<string | null | undefined>) => {\n    const seen = new Set<string>()\n    return values\n      .map((value) => String(value ?? '').trim())\n      .filter((value) => {\n        if (!value) return false\n        const key = commercialTermKey(value)\n        if (!key || seen.has(key)) return false\n        seen.add(key)\n        return true\n      })\n  }\n\n  const includeTerms = unique([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...includedLines.value.map((line) => line.name),\n  ])\n  const includeKeys = new Set(includeTerms.map(commercialTermKey))\n  const subjectTerms = unique([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text)))\n  const subjectKeys = new Set(subjectTerms.map(commercialTermKey))\n  const excludeTerms = unique(commercialTerms.excludes.map((item) => item.text)).filter((text) => {\n    const key = commercialTermKey(text)\n    return !includeKeys.has(key) && !subjectKeys.has(key)\n  })\n\n  draftIncludes.value = includeTerms.join(', ')\n  draftSubjectTo.value = subjectTerms.join(', ')\n  draftExcludes.value = excludeTerms.join(', ')\n  draftCommercialTermsInitialized.value = true\n}\n\n`
      code = replaceOne(
        code,
        termsHelperAnchor,
        termsHelpers + termsHelperAnchor,
        'draft commercial terms helper',
      )

      const persistedTermsAnchor = `      includes: includeTerms.join('\\n') || null,\n      subjectTo: subjectTerms.join('\\n') || null,\n      excludes: excludeTerms.join('\\n') || null,`
      const persistedTermsReplacement = `      includes: draftCommercialTermsInitialized.value\n        ? draftTermsForSave(draftIncludes.value)\n        : includeTerms.join('\\n') || null,\n      subjectTo: draftCommercialTermsInitialized.value\n        ? draftTermsForSave(draftSubjectTo.value)\n        : subjectTerms.join('\\n') || null,\n      excludes: draftCommercialTermsInitialized.value\n        ? draftTermsForSave(draftExcludes.value)\n        : excludeTerms.join('\\n') || null,`
      code = replaceOne(
        code,
        persistedTermsAnchor,
        persistedTermsReplacement,
        'persisted commercial terms',
      )

      const incotermWatchAnchor = `watch(\n  () => selectedIncotermCode.value,\n  (code) => {\n    nearestPortRecommendations.value = []\n    if (code !== 'FCA') form.warehouseId = ''\n    if (code !== 'EXW' && code !== 'FCA') {\n      form.pickupAddress = ''\n      form.pickupLatitude = null\n      form.pickupLongitude = null\n    }\n  },\n)\n\nwatch(\n  () => form.warehouseId,\n  () => {\n    if (selectedIncotermCode.value === 'FCA') void applySelectedWarehouse()\n  },\n)`
      const incotermWatchReplacement = `watch(\n  () => selectedIncotermCode.value,\n  (code) => {\n    nearestPortRecommendations.value = []\n    draftCommercialTermsInitialized.value = false\n\n    if (code === 'FOB') {\n      void applyAutomaticFobWarehouse()\n      return\n    }\n\n    if (code !== 'FCA') form.warehouseId = ''\n    if (code !== 'EXW' && code !== 'FCA') {\n      form.pickupAddress = ''\n      form.pickupLatitude = null\n      form.pickupLongitude = null\n    }\n  },\n)\n\nwatch(\n  () => form.originId,\n  () => {\n    draftCommercialTermsInitialized.value = false\n    if (selectedIncotermCode.value === 'FOB') void applyAutomaticFobWarehouse()\n  },\n)\n\nwatch(\n  () => form.warehouseId,\n  () => {\n    if (selectedIncotermCode.value === 'FCA') void applySelectedWarehouse()\n  },\n)`
      code = replaceOne(
        code,
        incotermWatchAnchor,
        incotermWatchReplacement,
        'Incoterm/FCA warehouse watchers',
      )

      const stepWatchAnchor = `watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n})`
      const stepWatchReplacement = `watch(step, (value) => {\n  if (value === 7) void loadHaciendaExchangeRate(false)\n  if (value === 8) void initializeDraftCommercialTerms()\n})`
      code = replaceOne(
        code,
        stepWatchAnchor,
        stepWatchReplacement,
        'wizard step watcher',
      )

      const routeSummaryAnchor = `          <div v-if="selectedEquipment || direction" class="crystal-route-summary">`
      const fobCard = `          <div v-if="selectedIncotermCode === 'FOB'" class="crystal-soft p-4">\n            <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">WHS automático por POL</p>\n            <template v-if="selectedWarehouse">\n              <p class="mt-2 text-sm font-black">{{ selectedWarehouse.label || displayValue(selectedWarehouse) || selectedWarehouse.code }}</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ form.pickupAddress || 'Dirección configurada en el catálogo del WHS.' }}</p>\n              <p class="mt-2 text-[11px] font-bold text-[var(--dh-primary)]">FOB resuelve este WHS automáticamente a partir del POL seleccionado. No requiere selección manual.</p>\n            </template>\n            <p v-else class="mt-2 text-xs font-bold text-amber-600">No existe un WHS asociado a este POL. Configure polCodes en Config → WHS globales.</p>\n          </div>\n\n`
      code = replaceOne(
        code,
        routeSummaryAnchor,
        fobCard + routeSummaryAnchor,
        'route summary / FOB warehouse card',
      )

      const step8CloseAnchor = `          </div>\n        </div>\n\n        <div v-else-if="step === 9 && viewOnly && editingRate" class="space-y-6">`
      const termsEditor = `          </div>\n\n          <section class="crystal-soft p-5">\n            <div class="flex flex-wrap items-start justify-between gap-3">\n              <div>\n                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Condiciones comerciales editables</p>\n                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Agregue o elimine términos antes de crear la tarifa. Puede separarlos con comas o saltos de línea.</p>\n              </div>\n              <DhBadge :variant="draftCommercialTermsInitialized ? 'success' : 'neutral'">\n                {{ draftCommercialTermsInitialized ? 'Listas para guardar' : 'Calculando términos…' }}\n              </DhBadge>\n            </div>\n            <div class="mt-4 grid gap-4 lg:grid-cols-3">\n              <DhTextarea v-model="draftIncludes" label="Tarifa incluye" :rows="6" placeholder="Ej. Flete internacional, BL, VGM" :disabled="viewOnly" />\n              <DhTextarea v-model="draftSubjectTo" label="Sujeta a" :rows="6" placeholder="Ej. Inspección aduanera, disponibilidad" :disabled="viewOnly" />\n              <DhTextarea v-model="draftExcludes" label="Tarifa no incluye" :rows="6" placeholder="Ej. Demoras, almacenaje extraordinario" :disabled="viewOnly" />\n            </div>\n          </section>\n        </div>\n\n        <div v-else-if="step === 9 && viewOnly && editingRate" class="space-y-6">`
      code = replaceOne(
        code,
        step8CloseAnchor,
        termsEditor,
        'Pantalla 8 commercial terms editor',
      )

      return { code, map: null }
    },
  }
}
