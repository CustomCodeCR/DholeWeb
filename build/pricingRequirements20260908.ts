import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingRequirements20260908] Missing ${label} anchor.`)
  }
  return source.replace(anchor, replacement)
}

function replaceAllRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (!count) throw new Error(`[pricingRequirements20260908] Missing ${label} anchor.`)
  return source.split(anchor).join(replacement)
}

function patchWizard(source: string) {
  let code = source

  // 10. Multimodal is no longer a top-level modality. Maritime owns the Panama flow.
  code = replaceRequired(
    code,
    `  { value: 'Multimodal', label: 'Multimodal', caption: 'Marítimo + terrestre' },\n`,
    '',
    'Multimodal modality option',
  )
  code = replaceRequired(
    code,
    `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">\n            <button\n              v-for="option in modalityOptions"`,
    `<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">\n            <button\n              v-for="option in modalityOptions"`,
    'screen 1 modality grid',
  )

  // 13/14. Land routes use dedicated Config catalogs instead of maritime ports.
  code = replaceRequired(
    code,
    `  poe: [] as CatalogItemSelectDto[],\n  landEquipmentTypes: [] as CatalogItemSelectDto[],`,
    `  poe: [] as CatalogItemSelectDto[],\n  landPol: [] as CatalogItemSelectDto[],\n  landPoe: [] as CatalogItemSelectDto[],\n  landEquipmentTypes: [] as CatalogItemSelectDto[],`,
    'land route catalog state',
  )
  code = replaceAllRequired(
    code,
    `      poe,\n      landEquipmentTypes,`,
    `      poe,\n      landPol,\n      landPoe,\n      landEquipmentTypes,`,
    'land route catalog assignment',
  )
  code = replaceRequired(
    code,
    `      select('poe'),\n      select('land-equipment-types'),`,
    `      select('poe'),\n      select('land-pol'),\n      select('land-poe'),\n      select('land-equipment-types'),`,
    'land route catalog loading',
  )

  // 9/11/13. The route options are modality-aware and Panama is represented by a virtual POE.
  const routeOptionsAnchor = `const originOptions = computed(() => catalogs.pol.map((item) => ({ value: item.id, label: displayValue(item) })))\nconst destinationOptions = computed(() => catalogs.poe.map((item) => ({ value: item.id, label: displayValue(item) })))\nconst podOptions = computed(() => catalogs.pod.map((item) => ({ value: item.id, label: displayValue(item) })))`
  const routeOptionsReplacement = `function pricingItemCountryCode(item: CatalogItemSelectDto | null | undefined) {\n  return String(metadata(item)?.countryCode ?? '').trim().toUpperCase()\n}\n\nfunction isMultimodalViaPanama(item: CatalogItemSelectDto | null | undefined) {\n  if (!item) return false\n  const meta = metadata(item)\n  const descriptor = normalizeCatalogValue([item.code, item.slug, item.label, displayValue(item)].filter(Boolean).join(' '))\n  return meta?.multimodalViaPanama === true\n    || String(item.code ?? '').trim().toUpperCase() === 'MULTIMODAL_VIA_PANAMA'\n    || descriptor.includes('multimodal via panama')\n}\n\nfunction isRealPanamaPoe(item: CatalogItemSelectDto | null | undefined) {\n  return Boolean(item && !isMultimodalViaPanama(item) && pricingItemCountryCode(item) === 'PA')\n}\n\nconst panamaPoeItems = computed(() => catalogs.poe.filter(isRealPanamaPoe))\nconst originCatalog = computed(() => form.modality === 'Land' ? catalogs.landPol : catalogs.pol)\nconst destinationCatalog = computed(() => {\n  if (form.modality === 'Land') return catalogs.landPoe\n  if (form.modality === 'Maritime' && shipmentModeForApi.value === 'Fcl') {\n    return catalogs.poe.filter((item) => isMultimodalViaPanama(item) || !isRealPanamaPoe(item))\n  }\n  return catalogs.poe.filter((item) => !isMultimodalViaPanama(item))\n})\n\nconst originOptions = computed(() => originCatalog.value.map((item) => ({ value: item.id, label: displayValue(item) })))\nconst destinationOptions = computed(() => destinationCatalog.value.map((item) => ({ value: item.id, label: displayValue(item) })))\nconst podOptions = computed(() => form.modality === 'Land' ? [] : catalogs.pod.map((item) => ({ value: item.id, label: displayValue(item) })))`
  code = replaceRequired(code, routeOptionsAnchor, routeOptionsReplacement, 'route options')

  code = replaceRequired(
    code,
    `const selectedOrigin = computed(() => findById(catalogs.pol, form.originId))\nconst selectedDestination = computed(() => findById(catalogs.poe, form.destinationId))\nconst selectedPod = computed(() => findById(catalogs.pod, form.podId))`,
    `const selectedOrigin = computed(() => findById(originCatalog.value, form.originId))\nconst selectedDestination = computed(() => findById(destinationCatalog.value, form.destinationId))\nconst selectedPod = computed(() => form.modality === 'Land' ? null : findById(catalogs.pod, form.podId))`,
    'selected route catalogs',
  )

  // 9. Remaining validity is measured from the requested load date, not from today.
  code = replaceRequired(
    code,
    `  const today = new Date(\`${'${todayIso()}'}T12:00:00\`)\n  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000))`,
    `  const loadDate = form.loadDate || todayIso()\n  const baseDate = new Date(\`${'${loadDate}'}T12:00:00\`)\n  return Math.max(0, Math.ceil((end.getTime() - baseDate.getTime()) / 86_400_000))`,
    'load-date validity calculation',
  )
  code = replaceAllRequired(code, `<span>días restantes</span>`, `<span>días desde carga hasta vencimiento</span>`, 'validity copy')

  // 11. When the pseudo POE is selected, query every real Panama POE and merge by rate id.
  code = replaceAllRequired(
    code,
    `await PricingService.selectImportRates(query)`,
    `await selectImportRatesForSelectedPoe(query)`,
    'approved rate lookup',
  )
  code = replaceRequired(
    code,
    `const selectedPod = computed(() => form.modality === 'Land' ? null : findById(catalogs.pod, form.podId))`,
    `const selectedPod = computed(() => form.modality === 'Land' ? null : findById(catalogs.pod, form.podId))\n\nasync function selectImportRatesForSelectedPoe(query: BrowseImportRatesQuery) {\n  if (!isMultimodalViaPanama(selectedDestination.value)) {\n    return PricingService.selectImportRates(query)\n  }\n\n  if (!panamaPoeItems.value.length) {\n    toastStore.warning('POE Panamá no configurados', 'Multimodal Via Panamá requiere al menos un POE real de Panamá en Config.')\n    return [] as ImportRateSelectDto[]\n  }\n\n  const results = await Promise.all(\n    panamaPoeItems.value.map((poe) => PricingService.selectImportRates({\n      ...query,\n      poe: catalogSearchText(poe),\n    })),\n  )\n  const unique = new Map<string, ImportRateSelectDto>()\n  results.flat().forEach((rate) => unique.set(rate.id, rate))\n  return [...unique.values()]\n}`,
    'Panama expanded lookup helper',
  )

  // 12. Land FTL/LTL visual language: closed/full trailer vs open trailer.
  code = replaceRequired(
    code,
    `              <span class="text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
    `              <span v-if="form.modality === 'Land'" class="mb-3 inline-flex h-10 min-w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 text-[var(--dh-primary)]">\n                <Truck v-if="String(option.value).toUpperCase() === 'FTL'" class="h-7 w-7" />\n                <span v-else class="relative block h-6 w-10 border-x-2 border-b-2 border-current">\n                  <span class="absolute -left-1 -right-1 bottom-1 h-0.5 bg-current" />\n                  <span class="absolute -bottom-1.5 left-1 h-2 w-2 rounded-full border-2 border-current bg-[var(--dh-card)]" />\n                  <span class="absolute -bottom-1.5 right-1 h-2 w-2 rounded-full border-2 border-current bg-[var(--dh-card)]" />\n                </span>\n              </span>\n              <span class="block text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
    'land shipment icons',
  )

  // 13. Land has only POL/POE and both selectors use the truck visual.
  code = replaceAllRequired(code, `terminal-type="CY"\n                :options="originOptions"`, `:terminal-type="form.modality === 'Land' ? 'SD' : 'CY'"\n                :options="originOptions"`, 'POL terminal icon')
  code = replaceAllRequired(code, `terminal-type="CY"\n                :options="destinationOptions"`, `:terminal-type="form.modality === 'Land' ? 'SD' : 'CY'"\n                :options="destinationOptions"`, 'POE terminal icon')
  code = replaceRequired(
    code,
    `<PricingLocationSearchSelect\n                v-model="form.podId"`,
    `<PricingLocationSearchSelect\n                v-if="form.modality !== 'Land'"\n                v-model="form.podId"`,
    'hide land POD',
  )
  code = replaceRequired(
    code,
    `<p class="crystal-description">Seleccione el POE. El POD es opcional; si existe una equivalencia clara, se sugiere automáticamente.</p>`,
    `<p class="crystal-description">{{ form.modality === 'Land' ? 'Seleccione POL y POE del catálogo terrestre. Para terrestre no se utiliza POD.' : 'Seleccione el POE. El POD es opcional; si existe una equivalencia clara, se sugiere automáticamente.' }}</p>`,
    'land route description',
  )

  // 15. Multiple land trailers are stored just like the mixed FCL distribution.
  code = replaceRequired(
    code,
    `const sellerExecutiveLabel = computed(() => {`,
    `interface LandExtraEquipmentRow {\n  key: string\n  containerTypeId: string\n  quantity: number\n}\n\nconst landExtraEquipment = ref<LandExtraEquipmentRow[]>([])\nconst landEquipmentOptions = computed(() => catalogs.landEquipmentTypes.map((item) => ({\n  value: item.id,\n  label: displayValue(item) || item.label || item.code,\n})))\n\nfunction landEquipmentItem(id: string) {\n  return catalogs.landEquipmentTypes.find((item) => item.id === id) ?? null\n}\n\nfunction landExtraEquipmentOptions(rowKey: string) {\n  const usedByOthers = new Set(landExtraEquipment.value\n    .filter((row) => row.key !== rowKey)\n    .map((row) => row.containerTypeId)\n    .filter(Boolean))\n  const current = landExtraEquipment.value.find((row) => row.key === rowKey)?.containerTypeId\n  return landEquipmentOptions.value.filter((option) =>\n    option.value === current || (option.value !== form.equipmentId && !usedByOthers.has(option.value)),\n  )\n}\n\nfunction addLandEquipment() {\n  const used = new Set([form.equipmentId, ...landExtraEquipment.value.map((row) => row.containerTypeId)].filter(Boolean))\n  const next = catalogs.landEquipmentTypes.find((item) => !used.has(item.id))\n  landExtraEquipment.value.push({ key: crypto.randomUUID(), containerTypeId: next?.id ?? '', quantity: 1 })\n}\n\nfunction removeLandEquipment(key: string) {\n  landExtraEquipment.value = landExtraEquipment.value.filter((row) => row.key !== key)\n}\n\nconst landEquipmentAllocations = computed(() => {\n  if (form.modality !== 'Land' || !selectedEquipment.value) return []\n  const primary = selectedEquipment.value\n  const rows = [{\n    containerTypeId: primary.id,\n    containerTypeName: displayValue(primary) || primary.label || primary.code,\n    containerTypeCode: primary.code,\n    quantity: Math.max(1, Math.trunc(number(form.equipmentQuantity))),\n  }]\n  const used = new Set([primary.id])\n  landExtraEquipment.value.forEach((row) => {\n    if (!row.containerTypeId || used.has(row.containerTypeId)) return\n    const item = landEquipmentItem(row.containerTypeId)\n    if (!item) return\n    used.add(item.id)\n    rows.push({\n      containerTypeId: item.id,\n      containerTypeName: displayValue(item) || item.label || item.code,\n      containerTypeCode: item.code,\n      quantity: Math.max(1, Math.trunc(number(row.quantity))),\n    })\n  })\n  return rows\n})\n\nconst landEquipmentTotal = computed(() => landEquipmentAllocations.value.reduce((sum, row) => sum + row.quantity, 0))\nconst landEquipmentSelectionValid = computed(() =>\n  form.modality !== 'Land' || landExtraEquipment.value.every((row) => Boolean(row.containerTypeId) && number(row.quantity) > 0),\n)\n\nfunction restoreRequestedLandContainers(value: unknown) {\n  if (!Array.isArray(value) || form.modality !== 'Land') {\n    landExtraEquipment.value = []\n    return\n  }\n  const rows = value as Array<Record<string, unknown>>\n  landExtraEquipment.value = rows\n    .filter((row) => String(row.containerTypeId ?? '') && String(row.containerTypeId ?? '') !== form.equipmentId)\n    .map((row) => ({\n      key: crypto.randomUUID(),\n      containerTypeId: String(row.containerTypeId ?? ''),\n      quantity: Math.max(1, Math.trunc(number(row.quantity))),\n    }))\n}\n\nwatch(() => [form.modality, form.equipmentId] as const, ([modality]) => {\n  if (modality !== 'Land') landExtraEquipment.value = []\n  else landExtraEquipment.value = landExtraEquipment.value.filter((row) => row.containerTypeId !== form.equipmentId)\n})\n\nconst sellerExecutiveLabel = computed(() => {`,
    'land equipment distribution state',
  )

  code = replaceRequired(
    code,
    `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`,
    `            <div v-if="form.modality === 'Land'" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 md:p-5">\n              <div class="flex flex-wrap items-center justify-between gap-3">\n                <div>\n                  <p class="font-black">Distribución de furgones</p>\n                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Puede seleccionar varios tamaños o tipos de furgón dentro de la misma solicitud.</p>\n                </div>\n                <DhButton variant="secondary" :disabled="!selectedEquipment" @click="addLandEquipment"><Plus class="h-4 w-4" /> Añadir furgón</DhButton>\n              </div>\n              <div v-if="selectedEquipment" class="mt-4 space-y-3">\n                <div class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">\n                  <div><span class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Furgón principal</span><strong class="mt-1 block">{{ displayValue(selectedEquipment) }}</strong></div>\n                  <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />\n                </div>\n                <div v-for="row in landExtraEquipment" :key="row.key" class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end">\n                  <DhSelect v-model="row.containerTypeId" label="Furgón adicional" :options="landExtraEquipmentOptions(row.key)" />\n                  <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  <DhButton variant="danger" @click="removeLandEquipment(row.key)">Quitar</DhButton>\n                </div>\n              </div>\n              <p v-if="selectedEquipment" class="mt-3 text-xs font-black text-[var(--dh-primary)]">Total: {{ landEquipmentTotal }} furgón{{ landEquipmentTotal === 1 ? '' : 'es' }}</p>\n            </div>\n\n            <!-- Fila 4: Incoterm y fecha de carga lista. -->`,
    'land multi-equipment UI',
  )

  // Persist land allocations in final rate payload and seller request context.
  code = replaceAllRequired(
    code,
    `shipmentModeForApi.value === 'Lcl' ? 0 : shipmentModeForApi.value === 'Fcl' ? Math.max(1, fclContainerTotal.value) : form.equipmentQuantity`,
    `shipmentModeForApi.value === 'Lcl' ? 0 : shipmentModeForApi.value === 'Fcl' ? Math.max(1, fclContainerTotal.value) : form.modality === 'Land' ? Math.max(1, landEquipmentTotal.value) : form.equipmentQuantity`,
    'land total equipment quantity',
  )
  code = replaceRequired(
    code,
    `        : shipmentModeForApi.value === 'Fcl'\n          ? fclContainerAllocations.value.map((row) => ({\n              containerTypeId: row.containerTypeId,\n              containerTypeName: row.containerTypeName,\n              containerTypeCode: row.containerTypeCode,\n              quantity: row.quantity,\n            }))\n          : [`,
    `        : shipmentModeForApi.value === 'Fcl'\n          ? fclContainerAllocations.value.map((row) => ({\n              containerTypeId: row.containerTypeId,\n              containerTypeName: row.containerTypeName,\n              containerTypeCode: row.containerTypeCode,\n              quantity: row.quantity,\n            }))\n          : form.modality === 'Land'\n            ? landEquipmentAllocations.value.map((row) => ({\n                containerTypeId: row.containerTypeId,\n                containerTypeName: row.containerTypeName,\n                containerTypeCode: row.containerTypeCode,\n                quantity: row.quantity,\n              }))\n            : [`,
    'land rate containers payload',
  )
  code = replaceRequired(
    code,
    `form: JSON.parse(JSON.stringify({ ...form, fclContainers: fclContainerAllocations.value }))`,
    `form: JSON.parse(JSON.stringify({ ...form, fclContainers: fclContainerAllocations.value, landContainers: landEquipmentAllocations.value }))`,
    'seller land distribution persistence',
  )
  code = replaceRequired(
    code,
    `restoreRequestedFclContainers((request.payload.form as Record<string, unknown>).fclContainers)`,
    `restoreRequestedFclContainers((request.payload.form as Record<string, unknown>).fclContainers)\n      restoreRequestedLandContainers((request.payload.form as Record<string, unknown>).landContainers)`,
    'seller land distribution restore',
  )
  code = replaceRequired(
    code,
    `              containers: fclContainerAllocations.value.map((row) => ({`,
    `              containers: (form.modality === 'Land' ? landEquipmentAllocations.value : fclContainerAllocations.value).map((row) => ({`,
    'seller land containers context',
  )

  code = replaceRequired(
    code,
    `function quantityForChargeBasis(basis: ChargeBasis) {\n  if (shipmentModeForApi.value === 'Fcl' && basis === 'PerContainer')`,
    `function quantityForChargeBasis(basis: ChargeBasis) {\n  if (form.modality === 'Land' && basis === 'PerContainer') return Math.max(1, landEquipmentTotal.value)\n  if (shipmentModeForApi.value === 'Fcl' && basis === 'PerContainer')`,
    'land per-unit charge quantity',
  )

  // 2/7. Seller client and hazardous technical sheet are mandatory in Web too.
  code = replaceRequired(
    code,
    `const supportAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xlsb'`,
    `const supportAccept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xlsb'\nconst hasDangerousTechSheet = computed(() => supportDocuments.value.some((document) => document.category === 'msds-tech-sheet'))`,
    'hazardous tech sheet state',
  )
  code = replaceRequired(code, `label="Cliente" placeholder="Seleccione cliente"`, `:label="props.sellerRequestMode ? 'Cliente *' : 'Cliente'" placeholder="Seleccione cliente"`, 'required client select label')
  code = replaceRequired(code, `label="Nombre del cliente" placeholder="Escriba el nombre del cliente"`, `:label="props.sellerRequestMode ? 'Nombre del cliente *' : 'Nombre del cliente'" placeholder="Escriba el nombre del cliente"`, 'required client input label')

  code = replaceRequired(
    code,
    `const canNext = computed(() => {`,
    `const requirements20260908Ready = computed(() => {\n  if (step.value === 3) {\n    if (props.sellerRequestMode && !form.clientId && !form.clientName.trim()) return false\n    if (!landEquipmentSelectionValid.value) return false\n  }\n  if (step.value === 4 && form.dangerousCargo && !hasDangerousTechSheet.value) return false\n  return true\n})\n\nconst canNext = computed(() => {`,
    'commercial validation state',
  )
  code = replaceAllRequired(code, `if (!canNext.value) return`, `if (!canNext.value || !requirements20260908Ready.value) return`, 'next requirements guard')
  code = replaceAllRequired(code, `:disabled="!canNext || (loadingRates && shipmentModeForApi === 'Fcl')"`, `:disabled="!canNext || !requirements20260908Ready || (loadingRates && shipmentModeForApi === 'Fcl')"`, 'continue requirements button')
  code = replaceRequired(code, `:disabled="saving || !canNext" @click="saveOpenRequest"`, `:disabled="saving || !canNext || !requirements20260908Ready" @click="saveOpenRequest"`, 'seller submit requirements button')

  code = replaceRequired(
    code,
    `async function saveOpenRequest() {\n  const origin = selectedOrigin.value`,
    `async function saveOpenRequest() {\n  if (!form.clientId && !form.clientName.trim()) {\n    toastStore.error('Seleccione el cliente antes de enviar la solicitud a Pricing.')\n    return\n  }\n  if (form.dangerousCargo && !hasDangerousTechSheet.value) {\n    toastStore.error('La ficha técnica / MSDS es obligatoria para carga peligrosa.')\n    return\n  }\n  if (!landEquipmentSelectionValid.value) {\n    toastStore.error('Complete todos los furgones y cantidades antes de enviar la solicitud.')\n    return\n  }\n  const origin = selectedOrigin.value`,
    'seller request mandatory fields',
  )
  code = replaceRequired(
    code,
    `<button type="button" class="crystal-flag" :class="form.dangerousCargo ? 'crystal-flag--active' : ''" @click="form.dangerousCargo = !form.dangerousCargo">\n              <Check v-if="form.dangerousCargo" class="h-4 w-4" /> Carga peligrosa\n            </button>`,
    `<button type="button" class="crystal-flag" :class="form.dangerousCargo ? 'crystal-flag--active' : ''" @click="form.dangerousCargo = !form.dangerousCargo">\n              <Check v-if="form.dangerousCargo" class="h-4 w-4" /> Carga peligrosa\n            </button>\n            <span v-if="form.dangerousCargo && !hasDangerousTechSheet" class="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-600 dark:text-red-300">Ficha técnica / MSDS obligatoria</span>`,
    'dangerous cargo warning',
  )

  // 16. Merchant and Carrier/Naviera haulage do not apply to the land screen.
  code = replaceRequired(
    code,
    `<button type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">`,
    `<button v-if="form.modality !== 'Land'" type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">`,
    'hide Merchant for land',
  )
  code = replaceRequired(
    code,
    `<button type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">`,
    `<button v-if="form.modality !== 'Land'" type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">`,
    'hide Carrier for land',
  )

  // 6. Every edit carries an explicit update reason; backend still enforces the allowed statuses/request window.
  code = replaceRequired(
    code,
    `const loadingExistingRate = ref(false)`,
    `const loadingExistingRate = ref(false)\nconst updateReason = ref('')`,
    'update reason state',
  )
  code = replaceRequired(
    code,
    `        extraDetails,\n        removedExtraDetailIds,`,
    `        extraDetails,\n        removedExtraDetailIds,\n        updateReason: updateReason.value.trim(),`,
    'update reason payload',
  )
  code = replaceRequired(
    code,
    `    if (editingRate.value) {\n      const originalDetailIds`,
    `    if (editingRate.value) {\n      if (!updateReason.value.trim()) {\n        toastStore.error('Indique el motivo de la actualización de la tarifa.')\n        return\n      }\n      const originalDetailIds`,
    'update reason guard',
  )
  code = replaceRequired(
    code,
    `      <div v-if="editingRate.status === 'AcceptedByClient' && !viewOnly"`,
    `      <div v-if="!viewOnly" class="mt-4">\n        <label class="block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Motivo de actualización *</label>\n        <textarea v-model="updateReason" rows="3" class="mt-2 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold outline-none focus:border-[var(--dh-primary)]" placeholder="Explique por qué se actualiza esta tarifa. El motivo quedará auditado." />\n      </div>\n      <div v-if="editingRate.status === 'AcceptedByClient' && !viewOnly"`,
    'update reason UI',
  )

  // Autosave the new land distribution and update reason too.
  if (code.includes(`fclExtraContainers: JSON.parse(JSON.stringify(fclExtraContainers.value)),`)) {
    code = code.replace(
      `fclExtraContainers: JSON.parse(JSON.stringify(fclExtraContainers.value)),`,
      `fclExtraContainers: JSON.parse(JSON.stringify(fclExtraContainers.value)),\n    landExtraEquipment: JSON.parse(JSON.stringify(landExtraEquipment.value)),\n    updateReason: updateReason.value,`,
    )
  }
  if (code.includes(`if (Array.isArray(draft.fclExtraContainers)) fclExtraContainers.value = draft.fclExtraContainers`)) {
    code = code.replace(
      `if (Array.isArray(draft.fclExtraContainers)) fclExtraContainers.value = draft.fclExtraContainers`,
      `if (Array.isArray(draft.fclExtraContainers)) fclExtraContainers.value = draft.fclExtraContainers\n    if (Array.isArray(draft.landExtraEquipment)) landExtraEquipment.value = draft.landExtraEquipment\n    if (typeof draft.updateReason === 'string') updateReason.value = draft.updateReason`,
    )
  }
  if (code.includes(`    fclExtraContainers,\n    fclRatesByContainer,`)) {
    code = code.replace(
      `    fclExtraContainers,\n    fclRatesByContainer,`,
      `    fclExtraContainers,\n    landExtraEquipment,\n    () => updateReason.value,\n    fclRatesByContainer,`,
    )
  }

  return code
}

export function pricingRequirements20260908(): Plugin {
  return {
    name: 'dhole-pricing-requirements-20260908',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
