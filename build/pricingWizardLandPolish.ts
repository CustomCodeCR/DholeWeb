import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source

  // POL/POE now contain both CY and SD records. The generic select endpoint intentionally
  // caps results, so use the complete catalog endpoint for route catalogs and let the
  // terminalType filters choose the correct subset afterwards.
  const selectAnchor = `    const select = (slug: string) => CatalogItemsService.select({ catalogGroupSlug: slug })`
  if (code.includes(selectAnchor) && !code.includes('const selectCompleteRouteCatalog = async')) {
    code = code.replace(
      selectAnchor,
      `${selectAnchor}\n    const selectCompleteRouteCatalog = async (slug: 'pol' | 'poe' | 'pod') => {\n      const items = await CatalogItemsService.getByGroupSlug(slug)\n      return items\n        .filter((item) => item.isActive)\n        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'es'))\n        .map((item): CatalogItemSelectDto => ({\n          id: item.id,\n          code: item.code,\n          slug: item.slug,\n          value: String(item.value ?? '').trim(),\n          label: String(item.value ?? item.name ?? '').trim(),\n          metadataJson: item.metadataJson,\n          isActive: item.isActive,\n        }))\n    }`,
    )
  }

  code = code.replace(`      select('pol'),`, `      selectCompleteRouteCatalog('pol'),`)
  code = code.replace(`      select('pod'),`, `      selectCompleteRouteCatalog('pod'),`)
  code = code.replace(`      select('poe'),`, `      selectCompleteRouteCatalog('poe'),`)

  // Pantalla 2: use the full width for the two terrestrial choices and guarantee the
  // requested full-trailer/open-trailer visual language.
  code = replaceOptional(
    code,
    `<div class="grid gap-4 md:grid-cols-3">\n            <button\n              v-for="option in shipmentModeOptions"`,
    `<div class="grid gap-4" :class="form.modality === 'Land' ? 'md:grid-cols-2' : 'md:grid-cols-3'">\n            <button\n              v-for="option in shipmentModeOptions"`,
  )

  if (!code.includes(`String(option.value).toUpperCase() === 'FTL'`)) {
    code = replaceOptional(
      code,
      `              <span class="text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
      `              <span v-if="form.modality === 'Land'" class="mb-3 inline-flex h-10 min-w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 text-[var(--dh-primary)]">\n                <Truck v-if="String(option.value).toUpperCase() === 'FTL'" class="h-7 w-7" />\n                <span v-else class="relative block h-6 w-10 border-x-2 border-b-2 border-current">\n                  <span class="absolute -left-1 -right-1 bottom-1 h-0.5 bg-current" />\n                  <span class="absolute -bottom-1.5 left-1 h-2 w-2 rounded-full border-2 border-current bg-[var(--dh-card)]" />\n                  <span class="absolute -bottom-1.5 right-1 h-2 w-2 rounded-full border-2 border-current bg-[var(--dh-card)]" />\n                </span>\n              </span>\n              <span class="block text-lg font-black">{{ option.label }}</span>\n              <Check v-if="form.shipmentMode === option.value"`,
    )
  }

  // Pantalla 3: two route fields on land, three on maritime. This eliminates the empty
  // POD column and gives POL/POE more useful horizontal space.
  code = replaceOptional(
    code,
    `            <!-- Fila 2: buscadores de ubicación estilo freight search. CY = Container Yard; SD = Store Door. -->\n            <div class="grid gap-4 md:grid-cols-3">`,
    `            <!-- Fila 2: buscadores de ubicación estilo freight search. CY = Container Yard; SD = Store Door. -->\n            <div class="grid gap-3" :class="form.modality === 'Land' ? 'md:grid-cols-2' : 'md:grid-cols-3'">`,
  )

  // The land distribution owns equipment selection, exactly as the maritime FCL block
  // owns container selection. Hide the legacy single-equipment row for terrestrial.
  code = replaceOptional(
    code,
    `v-if="shipmentModeForApi !== 'Lcl' && shipmentModeForApi !== 'Fcl'" class="grid gap-4 md:grid-cols-3"`,
    `v-if="form.modality !== 'Land' && shipmentModeForApi !== 'Lcl' && shipmentModeForApi !== 'Fcl'" class="grid gap-4 md:grid-cols-3"`,
  )

  // Improve the land extra-equipment state so incomplete rows are explicit and duplicate
  // furgón types cannot be selected accidentally.
  const addLandAnchor = `function addLandEquipment() {\n  const used = new Set([form.equipmentId, ...landExtraEquipment.value.map((row) => row.containerTypeId)].filter(Boolean))\n  const next = catalogs.landEquipmentTypes.find((item) => !used.has(item.id))\n  landExtraEquipment.value.push({ key: crypto.randomUUID(), containerTypeId: next?.id ?? '', quantity: 1 })\n}`
  if (code.includes(addLandAnchor)) {
    code = code.replace(
      addLandAnchor,
      `const canAddLandEquipment = computed(() => {\n  if (!selectedEquipment.value) return false\n  if (landExtraEquipment.value.some((row) => !row.containerTypeId)) return false\n  const used = new Set([form.equipmentId, ...landExtraEquipment.value.map((row) => row.containerTypeId)].filter(Boolean))\n  return catalogs.landEquipmentTypes.some((item) => !used.has(item.id))\n})\n\nfunction landExtraExcludedEquipmentIds(rowKey: string) {\n  return [\n    form.equipmentId,\n    ...landExtraEquipment.value\n      .filter((row) => row.key !== rowKey)\n      .map((row) => row.containerTypeId),\n  ].filter(Boolean)\n}\n\nfunction addLandEquipment() {\n  if (!canAddLandEquipment.value) return\n  landExtraEquipment.value.push({ key: crypto.randomUUID(), containerTypeId: '', quantity: 1 })\n}`,
    )
  }

  // Replace the duplicated terrestrial equipment section with one compact distribution
  // component: size + type + quantity for every furgón, including the primary one.
  const landTitle = `<p class="font-black">Distribución de furgones</p>`
  const landTitleIndex = code.indexOf(landTitle)
  if (landTitleIndex >= 0) {
    const landStart = code.lastIndexOf(`            <div v-if="form.modality === 'Land'"`, landTitleIndex)
    const row4Anchor = `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`
    const landEnd = code.indexOf(row4Anchor, landTitleIndex)
    if (landStart >= 0 && landEnd > landStart) {
      const compactLandBlock = `            <div v-if="form.modality === 'Land'" class="overflow-hidden rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.035)]">\n              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--dh-primary-rgb)/0.16)] px-4 py-3 md:px-5">\n                <div>\n                  <p class="font-black text-[var(--dh-text)]">Distribución de furgones</p>\n                  <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">Agregue los tamaños y tipos necesarios en la misma cotización terrestre.</p>\n                </div>\n                <DhButton variant="secondary" :disabled="!canAddLandEquipment" @click="addLandEquipment">\n                  <Plus class="h-4 w-4" /> Añadir furgón\n                </DhButton>\n              </div>\n\n              <div class="space-y-3 p-4 md:p-5">\n                <div class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.055)] p-4">\n                  <div class="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Furgón 1</div>\n                  <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-end">\n                    <PricingContainerSelector\n                      v-model="form.equipmentId"\n                      transport="land"\n                      :excluded-equipment-ids="landExtraEquipment.map((row) => row.containerTypeId).filter(Boolean)"\n                      :show-resolved-label="false"\n                    />\n                    <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />\n                  </div>\n                </div>\n\n                <div\n                  v-for="(row, index) in landExtraEquipment"\n                  :key="row.key"\n                  class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"\n                >\n                  <div class="mb-2 flex items-center justify-between gap-3">\n                    <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Furgón {{ index + 2 }}</span>\n                    <DhButton variant="danger" size="sm" @click="removeLandEquipment(row.key)">Quitar</DhButton>\n                  </div>\n                  <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-end">\n                    <PricingContainerSelector\n                      v-model="row.containerTypeId"\n                      transport="land"\n                      :excluded-equipment-ids="landExtraExcludedEquipmentIds(row.key)"\n                      :show-resolved-label="false"\n                    />\n                    <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />\n                  </div>\n                </div>\n\n                <div v-if="selectedEquipment" class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.20)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-2.5">\n                  <strong class="text-sm text-[var(--dh-primary)]">Total: {{ landEquipmentTotal }} furgón{{ landEquipmentTotal === 1 ? '' : 'es' }}</strong>\n                  <div class="flex flex-wrap gap-2">\n                    <span v-for="allocation in landEquipmentAllocations" :key="'land-summary:' + allocation.containerTypeId" class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-2.5 py-1 text-[10px] font-black text-[var(--dh-text-soft)]">\n                      {{ allocation.quantity }} × {{ allocation.containerTypeName }}\n                    </span>\n                  </div>\n                </div>\n              </div>\n            </div>\n\n`
      code = code.slice(0, landStart) + compactLandBlock + code.slice(landEnd)
    }
  }

  // Incoterm + both dates fit naturally on one desktop row.
  code = replaceOptional(
    code,
    `            <!-- Fila 4: Incoterm y fecha de carga lista. -->\n            <div class="grid gap-4 md:grid-cols-2">`,
    `            <!-- Fila 4: Incoterm y vigencia. -->\n            <div class="grid gap-3 md:grid-cols-3">`,
  )

  // Safety net for deployments that did not yet receive the September terrestrial plugin.
  code = replaceOptional(
    code,
    `<button type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">`,
    `<button v-if="form.modality !== 'Land'" type="button" class="crystal-flag" :class="form.merchantHaulage ? 'crystal-flag--active' : ''" @click="toggleMerchantHaulage">`,
  )
  code = replaceOptional(
    code,
    `<button type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">`,
    `<button v-if="form.modality !== 'Land'" type="button" class="crystal-flag" :class="form.carrierHaulage ? 'crystal-flag--active' : ''" @click="toggleCarrierHaulage">`,
  )

  return code
}

export function pricingWizardLandPolish(): Plugin {
  return {
    name: 'dhole-pricing-wizard-land-polish',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
