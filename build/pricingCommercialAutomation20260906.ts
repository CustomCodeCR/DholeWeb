import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingCommercialAutomation20260906] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Completing a seller request now sends the created rate and closes the request in one backend flow.
  if (code.includes("'/attach-rate'")) {
    code = code.replace("'/attach-rate'", "'/complete-rate'")
  }

  const sellerLabelAnchor = `const sellerExecutiveLabel = computed(() => {`
  const fclState = `interface FclExtraContainerRow {
  key: string
  containerTypeId: string
  quantity: number
  freightCostAmount: number
  freightSaleAmount: number
  freightTouched: boolean
}

const fclExtraContainers = ref<FclExtraContainerRow[]>([])

function fclContainerItem(containerTypeId: string) {
  return catalogs.containers.find((item) => item.id === containerTypeId) ?? null
}

function fclContainerName(containerTypeId: string) {
  const item = fclContainerItem(containerTypeId)
  return item ? (displayValue(item) || item.label || item.code) : 'Contenedor'
}

const fclContainerOptions = computed(() => catalogs.containers.map((item) => ({
  value: item.id,
  label: displayValue(item) || item.label || item.code,
})))

function fclExtraContainerOptions(rowKey: string) {
  const primaryId = form.equipmentId
  const selectedByOthers = new Set(
    fclExtraContainers.value
      .filter((row) => row.key !== rowKey)
      .map((row) => row.containerTypeId)
      .filter(Boolean),
  )
  const current = fclExtraContainers.value.find((row) => row.key === rowKey)?.containerTypeId
  return fclContainerOptions.value.filter((option) =>
    option.value === current || (option.value !== primaryId && !selectedByOthers.has(option.value)),
  )
}

function addFclContainer() {
  const used = new Set([form.equipmentId, ...fclExtraContainers.value.map((row) => row.containerTypeId)].filter(Boolean))
  const next = catalogs.containers.find((item) => !used.has(item.id))
  fclExtraContainers.value.push({
    key: crypto.randomUUID(),
    containerTypeId: next?.id ?? '',
    quantity: 1,
    freightCostAmount: number(form.freightCost),
    freightSaleAmount: number(form.freightSale),
    freightTouched: false,
  })
}

function removeFclContainer(key: string) {
  fclExtraContainers.value = fclExtraContainers.value.filter((row) => row.key !== key)
}

const fclContainerAllocations = computed(() => {
  if (shipmentModeForApi.value !== 'Fcl') return []
  const primary = selectedEquipment.value
  if (!primary) return []

  const rows = [{
    containerTypeId: primary.id,
    containerTypeName: displayValue(primary) || primary.label || primary.code,
    containerTypeCode: primary.code,
    quantity: Math.max(1, Math.trunc(number(form.equipmentQuantity))),
    freightCostAmount: number(form.freightCost),
    freightSaleAmount: number(form.freightSale),
  }]

  const used = new Set([primary.id])
  fclExtraContainers.value.forEach((row) => {
    if (!row.containerTypeId || used.has(row.containerTypeId)) return
    const item = fclContainerItem(row.containerTypeId)
    if (!item) return
    used.add(item.id)
    rows.push({
      containerTypeId: item.id,
      containerTypeName: displayValue(item) || item.label || item.code,
      containerTypeCode: item.code,
      quantity: Math.max(1, Math.trunc(number(row.quantity))),
      freightCostAmount: number(row.freightCostAmount),
      freightSaleAmount: number(row.freightSaleAmount),
    })
  })

  return rows
})

const fclContainerTotal = computed(() =>
  fclContainerAllocations.value.reduce((total, row) => total + row.quantity, 0),
)

const fclContainerTeu = computed(() =>
  fclContainerAllocations.value.reduce((total, row) => {
    const descriptor = normalizeCatalogValue(row.containerTypeCode + ' ' + row.containerTypeName)
    const multiplier = /(^|\\D)20(\\D|$)/.test(descriptor) ? 1 : 2
    return total + row.quantity * multiplier
  }, 0),
)

function restoreRequestedFclContainers(value: unknown) {
  if (!Array.isArray(value) || shipmentModeForApi.value !== 'Fcl') {
    fclExtraContainers.value = []
    return
  }
  const rows = value as Array<Record<string, unknown>>
  fclExtraContainers.value = rows
    .filter((row) => String(row.containerTypeId ?? '') && String(row.containerTypeId ?? '') !== form.equipmentId)
    .map((row) => ({
      key: crypto.randomUUID(),
      containerTypeId: String(row.containerTypeId ?? ''),
      quantity: Math.max(1, Math.trunc(number(row.quantity))),
      freightCostAmount: number(row.freightCostAmount),
      freightSaleAmount: number(row.freightSaleAmount),
      freightTouched: false,
    }))
}

function isFreeDayCommercialTerm(value: string) {
  const text = normalizeCatalogValue(value)
  return text.includes('dias libres') && (text.includes('contenedor') || text.includes('container'))
}

watch(
  () => [form.shipmentMode, form.equipmentId] as const,
  ([mode]) => {
    if (String(mode).trim().toUpperCase() !== 'FCL') fclExtraContainers.value = []
    else {
      fclExtraContainers.value = fclExtraContainers.value.filter((row) => row.containerTypeId !== form.equipmentId)
    }
  },
)

watch(
  () => [form.selectedImportRateId, form.freightCost, form.freightSale] as const,
  () => {
    if (shipmentModeForApi.value !== 'Fcl') return
    fclExtraContainers.value.forEach((row) => {
      if (row.freightTouched) return
      row.freightCostAmount = number(form.freightCost)
      row.freightSaleAmount = number(form.freightSale)
    })
  },
)

`
  code = replaceOne(code, sellerLabelAnchor, fclState + sellerLabelAnchor, 'FCL mix state')

  // Pickup/Recolección is always an origin-side EXW charge, regardless of a legacy POE/cost classification.
  const sectionAnchor = `function sectionForCost(cost: CostSelectDto): RateSection {\n  const byPortRole = sectionFromPortRole(cost)`
  const sectionReplacement = `function sectionForCost(cost: CostSelectDto): RateSection {\n  const normalizedCostName = normalizeCatalogValue(cost.name)\n  if (normalizedCostName.includes('pickup') || normalizedCostName.includes('pick up') || normalizedCostName.includes('recoleccion')) {\n    return 'pickup_origin'\n  }\n  const byPortRole = sectionFromPortRole(cost)`
  code = replaceOne(code, sectionAnchor, sectionReplacement, 'pickup origin classification')

  // Mixed FCL generic charges use all containers/TEU instead of only the first selected type.
  const quantityAnchor = `function quantityForChargeBasis(basis: ChargeBasis) {`
  code = replaceOne(
    code,
    quantityAnchor,
    `function quantityForChargeBasis(basis: ChargeBasis) {\n  if (shipmentModeForApi.value === 'Fcl' && basis === 'PerContainer') return Math.max(1, fclContainerTotal.value)\n  if (shipmentModeForApi.value === 'Fcl' && basis === 'PerTeu') return Math.max(1, fclContainerTeu.value)`,
    'FCL quantity basis',
  )

  // Make terms shown on Pantalla 8 follow the real included/optional charge lines and the actual quoted free days.
  const draftAssignmentAnchor = `  draftCommercialTerms.value = { includes, subjectTo, excludes }\n  draftCommercialTermsInitialized.value = true`
  const draftAssignmentReplacement = `  const linkedIncludes = uniqueCommercialTerms([\n    ...includes.filter((text) => !isFreeDayCommercialTerm(text)),\n    ...includedLines.value.map((line) => line.name),\n  ]).filter((text) => !isFreeDayCommercialTerm(text))\n  const linkedIncludeKeys = new Set(linkedIncludes.map((text) => commercialTermKey(text) || normalizeCatalogValue(text)))\n  const linkedSubjectTo = uniqueCommercialTerms([\n    ...subjectTo.filter((text) => !isFreeDayCommercialTerm(text)),\n    ...rateLines.value.filter((line) => line.optional && !line.included).map((line) => line.name),\n  ]).filter((text) => !linkedIncludeKeys.has(commercialTermKey(text) || normalizeCatalogValue(text)) && !isFreeDayCommercialTerm(text))\n  if (shipmentModeForApi.value === 'Fcl' && number(form.freeDays) > 0) {\n    linkedSubjectTo.push(Math.trunc(number(form.freeDays)) + ' días libres de contenedor')\n  }\n  const linkedSubjectKeys = new Set(linkedSubjectTo.map((text) => commercialTermKey(text) || normalizeCatalogValue(text)))\n  const linkedExcludes = uniqueCommercialTerms(excludes)\n    .filter((text) => !isFreeDayCommercialTerm(text))\n    .filter((text) => {\n      const key = commercialTermKey(text) || normalizeCatalogValue(text)\n      return !linkedIncludeKeys.has(key) && !linkedSubjectKeys.has(key)\n    })\n  draftCommercialTerms.value = { includes: linkedIncludes, subjectTo: linkedSubjectTo, excludes: linkedExcludes }\n  draftCommercialTermsInitialized.value = true`
  code = replaceOne(code, draftAssignmentAnchor, draftAssignmentReplacement, 'dynamic draft commercial terms')

  const includeTermsAnchor = `  const includeTerms = uniqueTermLines([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...(lclSelectedSource.value?.includes ?? []),\n  ])`
  const includeTermsReplacement = `  const includeTerms = uniqueTermLines([\n    ...commercialTerms.includes.map((item) => item.text),\n    ...(lclSelectedSource.value?.includes ?? []),\n    ...includedLines.value.map((line) => line.name),\n  ]).filter((text) => !isFreeDayCommercialTerm(text))`
  code = replaceOne(code, includeTermsAnchor, includeTermsReplacement, 'persist linked includes')

  const subjectTermsAnchor = `  const subjectTerms = uniqueTermLines([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    ...(lclSelectedSource.value?.subjectTo ?? []),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text)))`
  const subjectTermsReplacement = `  const subjectTerms = uniqueTermLines([\n    ...commercialTerms.subjectTo.map((item) => item.text),\n    ...(lclSelectedSource.value?.subjectTo ?? []),\n    ...rateLines.value.filter((line) => line.optional && !line.included).map((line) => line.name),\n    form.dangerousCargo ? 'Carga peligrosa' : null,\n    form.nonStackable ? 'Carga no estibable' : null,\n    form.overweight ? 'Sobrepeso' : null,\n  ]).filter((text) => !includeKeys.has(commercialTermKey(text)) && !isFreeDayCommercialTerm(text))\n  if (shipmentModeForApi.value === 'Fcl' && number(form.freeDays) > 0) {\n    subjectTerms.push(Math.trunc(number(form.freeDays)) + ' días libres de contenedor')\n  }`
  code = replaceOne(code, subjectTermsAnchor, subjectTermsReplacement, 'persist dynamic subject terms')

  const excludeFilterAnchor = `  ]).filter((text) => {\n    const key = commercialTermKey(text)\n    return !includeKeys.has(key) && !subjectKeys.has(key)\n  })`
  const excludeFilterReplacement = `  ]).filter((text) => {\n    if (isFreeDayCommercialTerm(text)) return false\n    const key = commercialTermKey(text)\n    return !includeKeys.has(key) && !subjectKeys.has(key)\n  })`
  code = replaceOne(code, excludeFilterAnchor, excludeFilterReplacement, 'remove static free days from excludes')

  // The seller request keeps the complete FCL distribution so Pricing resumes it unchanged.
  const requestFormAnchor = `            form: JSON.parse(JSON.stringify(form)),`
  code = replaceOne(
    code,
    requestFormAnchor,
    `            form: JSON.parse(JSON.stringify({ ...form, fclContainers: fclContainerAllocations.value })),`,
    'seller FCL request persistence',
  )

  const requestHydrateAnchor = `    if (request.payload?.form) Object.assign(form, request.payload.form)`
  code = replaceOne(
    code,
    requestHydrateAnchor,
    `    if (request.payload?.form) {\n      Object.assign(form, request.payload.form)\n      restoreRequestedFclContainers((request.payload.form as Record<string, unknown>).fclContainers)\n    }`,
    'seller FCL request restore',
  )

  const requestContextAnchor = `              equipmentQuantity: Math.max(1, Number(form.equipmentQuantity || 1)),`
  code = replaceOne(
    code,
    requestContextAnchor,
    `              equipmentQuantity: shipmentModeForApi.value === 'Fcl' ? Math.max(1, fclContainerTotal.value) : Math.max(1, Number(form.equipmentQuantity || 1)),\n              containers: fclContainerAllocations.value.map((row) => ({\n                containerTypeId: row.containerTypeId,\n                containerTypeName: row.containerTypeName,\n                containerTypeCode: row.containerTypeCode,\n                quantity: row.quantity,\n              })),`,
    'seller FCL request context',
  )

  // Persist every FCL equipment allocation while keeping the legacy first-container snapshot.
  const containerQuantityAnchor = `      containerQuantity: shipmentModeForApi.value === 'Lcl' ? 0 : form.equipmentQuantity,`
  code = replaceOne(
    code,
    containerQuantityAnchor,
    `      containerQuantity: shipmentModeForApi.value === 'Lcl' ? 0 : shipmentModeForApi.value === 'Fcl' ? Math.max(1, fclContainerTotal.value) : form.equipmentQuantity,`,
    'FCL total container quantity',
  )

  const containersAnchor = `      containers: shipmentModeForApi.value === 'Lcl'\n        ? []\n        : [\n            {\n              containerTypeId: equipment!.id,\n              containerTypeName: equipmentName,\n              containerTypeCode: equipment!.code,\n              quantity: form.equipmentQuantity,\n            },\n          ],`
  const containersReplacement = `      containers: shipmentModeForApi.value === 'Lcl'\n        ? []\n        : shipmentModeForApi.value === 'Fcl'\n          ? fclContainerAllocations.value.map((row) => ({\n              containerTypeId: row.containerTypeId,\n              containerTypeName: row.containerTypeName,\n              containerTypeCode: row.containerTypeCode,\n              quantity: row.quantity,\n            }))\n          : [\n              {\n                containerTypeId: equipment!.id,\n                containerTypeName: equipmentName,\n                containerTypeCode: equipment!.code,\n                quantity: form.equipmentQuantity,\n              },\n            ],`
  code = replaceOne(code, containersAnchor, containersReplacement, 'FCL container allocations payload')

  // A mixed FCL needs one freight detail per equipment type, otherwise the first rate would be multiplied by every container.
  const detailsEndAnchor = `  }))\n\n  const includedNameKeys = new Set(`
  const detailsEndReplacement = `  }))\n\n  if (shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1) {\n    const freightIndex = details.findIndex((detail) => detail.costDetailType === 'Freight')\n    if (freightIndex >= 0) {\n      const baseFreight = details[freightIndex]\n      const mixedFreightDetails = fclContainerAllocations.value.map((allocation, index) => ({\n        ...baseFreight,\n        costId: index === 0 ? baseFreight.costId : null,\n        name: baseFreight.name + ' · ' + allocation.containerTypeName,\n        chargeBasis: 'PerContainer' as ChargeBasis,\n        costAmount: allocation.freightCostAmount,\n        saleAmount: allocation.freightSaleAmount,\n        quantity: allocation.quantity,\n        notes: [baseFreight.notes, 'Flete específico para ' + allocation.quantity + ' × ' + allocation.containerTypeName].filter(Boolean).join(' · '),\n      }))\n      details.splice(freightIndex, 1, ...mixedFreightDetails)\n    }\n  }\n\n  const includedNameKeys = new Set(`
  code = replaceOne(code, detailsEndAnchor, detailsEndReplacement, 'mixed FCL freight details')

  // Clear the mix when starting another quotation.
  const resetAnchor = `function resetWizard() {\n  step.value = 1`
  code = replaceOne(code, resetAnchor, `function resetWizard() {\n  fclExtraContainers.value = []\n  step.value = 1`, 'reset FCL mix')

  // FCL mix controls appear directly after the primary equipment selector.
  const row4Anchor = `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`
  const mixUi = `            <div v-if="shipmentModeForApi === 'Fcl'" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:p-5">\n              <div class="flex flex-wrap items-center justify-between gap-3">\n                <div>\n                  <p class="font-black">Distribución de contenedores FCL</p>\n                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Puede combinar varios tipos en la misma cotización, por ejemplo 1 × 20DV + 5 × 40HC.</p>\n                </div>\n                <DhButton variant="secondary" :disabled="!selectedEquipment" @click="addFclContainer"><Plus class="h-4 w-4" /> Añadir contenedor</DhButton>\n              </div>\n\n              <div v-if="selectedEquipment" class="mt-4 space-y-3">\n                <div class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">\n                  <div>\n                    <span class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Contenedor principal</span>\n                    <strong class="mt-1 block">{{ displayValue(selectedEquipment) }}</strong>\n                  </div>\n                  <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />\n                </div>\n\n                <div v-for="row in fclExtraContainers" :key="row.key" class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end">\n                  <DhSelect v-model="row.containerTypeId" label="Contenedor adicional" :options="fclExtraContainerOptions(row.key)" />\n                  <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  <DhButton variant="danger" @click="removeFclContainer(row.key)">Quitar</DhButton>\n                </div>\n              </div>\n\n              <p v-if="selectedEquipment" class="mt-3 text-xs font-black text-[var(--dh-primary)]">\n                Total: {{ fclContainerTotal }} contenedores · {{ fclContainerTeu }} TEU\n              </p>\n            </div>\n\n`
  code = replaceOne(code, row4Anchor, mixUi + row4Anchor, 'FCL mix UI')

  const providerSummaryAnchor = `          <div class="crystal-route-summary grid gap-3 md:grid-cols-4">`
  const freightMixUi = `          <div v-if="shipmentModeForApi === 'Fcl' && fclExtraContainers.length" class="crystal-soft space-y-3 p-4 md:p-5">\n            <div>\n              <p class="font-black">Flete internacional por tipo de contenedor</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El contenedor principal usa los valores superiores. Los adicionales se inicializan con ese flete y pueden modificarse individualmente.</p>\n            </div>\n            <div v-for="row in fclExtraContainers" :key="'freight:' + row.key" class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(0,1fr)_180px_180px] md:items-end">\n              <div>\n                <span class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ row.quantity }} × contenedor</span>\n                <strong class="mt-1 block">{{ fclContainerName(row.containerTypeId) }}</strong>\n              </div>\n              <DhInput v-model.number="row.freightCostAmount" type="number" min="0" step="0.01" label="Flete · costo" @update:model-value="row.freightTouched = true" />\n              <DhInput v-model.number="row.freightSaleAmount" type="number" min="0" step="0.01" label="Flete · venta" @update:model-value="row.freightTouched = true" />\n            </div>\n          </div>\n\n`
  code = replaceOne(code, providerSummaryAnchor, freightMixUi + providerSummaryAnchor, 'FCL freight mix UI')

  return code
}

export function pricingCommercialAutomation20260906(): Plugin {
  return {
    name: 'dhole-pricing-commercial-automation-20260906',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
