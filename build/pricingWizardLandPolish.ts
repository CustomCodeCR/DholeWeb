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

  // FCL/FTL use their distribution component and LCL/LTL are consolidated cargo.
  // None of those four modes should render the legacy standalone equipment row.
  // Accept every guard shape produced by the earlier parity plugins so FTL cannot
  // accidentally show a duplicated "Tipo de furgón / Cantidad" selector.
  const standaloneEquipmentGuards = [
    `v-if="shipmentModeForApi !== 'Fcl' && !['Lcl', 'Ltl'].includes(shipmentModeForApi)" class="grid gap-4 md:grid-cols-3"`,
    `v-if="!['Lcl', 'Ltl'].includes(shipmentModeForApi)" class="grid gap-4 md:grid-cols-3"`,
    `v-if="shipmentModeForApi !== 'Lcl' && shipmentModeForApi !== 'Fcl'" class="grid gap-4 md:grid-cols-3"`,
  ]
  const unifiedEquipmentGuard =
    `v-if="!['Fcl', 'Ftl', 'Lcl', 'Ltl'].includes(shipmentModeForApi)" class="grid gap-4 md:grid-cols-3"`

  standaloneEquipmentGuards.forEach((guard) => {
    code = replaceOptional(code, guard, unifiedEquipmentGuard)
  })

  // Improve the land extra-equipment state so incomplete rows are explicit and duplicate
  // furgón types cannot be selected accidentally.
  const addLandAnchor = `function addLandEquipment() {\n  const used = new Set([form.equipmentId, ...landExtraEquipment.value.map((row) => row.containerTypeId)].filter(Boolean))\n  const next = catalogs.landEquipmentSizes.find((item) => !used.has(item.id))\n  landExtraEquipment.value.push({ key: crypto.randomUUID(), containerTypeId: next?.id ?? '', quantity: 1 })\n}`
  if (code.includes(addLandAnchor)) {
    code = code.replace(
      addLandAnchor,
      `const canAddLandEquipment = computed(() => {\n  if (!selectedEquipment.value) return false\n  if (landExtraEquipment.value.some((row) => !row.containerTypeId)) return false\n  const used = new Set([form.equipmentId, ...landExtraEquipment.value.map((row) => row.containerTypeId)].filter(Boolean))\n  return catalogs.landEquipmentSizes.some((item) => !used.has(item.id))\n})\n\nfunction landExtraExcludedEquipmentIds(rowKey: string) {\n  return [\n    form.equipmentId,\n    ...landExtraEquipment.value\n      .filter((row) => row.key !== rowKey)\n      .map((row) => row.containerTypeId),\n  ].filter(Boolean)\n}\n\nfunction addLandEquipment() {\n  if (!canAddLandEquipment.value) return\n  landExtraEquipment.value.push({ key: crypto.randomUUID(), containerTypeId: '', quantity: 1 })\n}`,
    )
  }

  // Replace the duplicated terrestrial equipment section with one compact distribution
  // component: size + type + quantity for every furgón, including the primary one.
  const landTitle = `<p class="font-black">Distribución de furgones</p>`
  const landTitleIndex = code.indexOf(landTitle)
  if (landTitleIndex >= 0) {
    const landStart = code.lastIndexOf(`            <div v-if="form.modality === 'Land'`, landTitleIndex)
    const row4Anchors = [
      `            <!-- Fila 4: Incoterm y fecha de carga lista. -->`,
      `            <!-- Fila 4: Incoterm y vigencia. -->`,
    ]
    const landEnd = row4Anchors
      .map((anchor) => code.indexOf(anchor, landTitleIndex))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0] ?? -1

    if (landStart >= 0 && landEnd > landStart) {
      const compactLandBlock = `            <div v-if="shipmentModeForApi === 'Ftl'" class="overflow-hidden rounded-[22px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.035)]">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--dh-primary-rgb)/0.16)] px-4 py-4 md:px-5">
                <p class="font-black text-[var(--dh-text)]">Distribución de furgones FTL</p>
                <DhButton variant="secondary" :disabled="!canAddLandEquipment" @click="addLandEquipment">
                  <Plus class="h-4 w-4" /> Añadir furgón
                </DhButton>
              </div>

              <div class="space-y-3 p-4 md:p-5">
                <div class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.055)] p-4">
                  <div class="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Furgón 1</div>
                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">
                    <PricingContainerSelector
                      v-model="form.equipmentId"
                      transport="land"
                      :excluded-equipment-ids="landExtraEquipment.map((row) => row.containerTypeId).filter(Boolean)"
                      :show-resolved-label="false"
                    />
                    <DhInput v-model.number="form.equipmentQuantity" type="number" min="1" label="Cantidad" />
                  </div>
                </div>

                <div
                  v-for="(row, index) in landExtraEquipment"
                  :key="row.key"
                  class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
                >
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <span class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Furgón {{ index + 2 }}</span>
                    <DhButton variant="danger" size="sm" @click="removeLandEquipment(row.key)">Quitar</DhButton>
                  </div>
                  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end">
                    <PricingContainerSelector
                      v-model="row.containerTypeId"
                      transport="land"
                      :excluded-equipment-ids="landExtraExcludedEquipmentIds(row.key)"
                      :show-resolved-label="false"
                    />
                    <DhInput v-model.number="row.quantity" type="number" min="1" label="Cantidad" />
                  </div>
                </div>

                <div v-if="selectedEquipment" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.20)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-3">
                  <strong class="text-sm text-[var(--dh-primary)]">Total: {{ landEquipmentTotal }} furgón{{ landEquipmentTotal === 1 ? '' : 'es' }}</strong>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="allocation in landEquipmentAllocations"
                      :key="'land-summary:' + allocation.containerTypeId"
                      class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-1 text-[11px] font-black text-[var(--dh-text-soft)]"
                    >
                      {{ allocation.quantity }} × {{ allocation.containerTypeName }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

`
      code = code.slice(0, landStart) + compactLandBlock + code.slice(landEnd)
    } else {
      throw new Error(
        '[pricingWizardLandPolish] FTL distribution block could not be replaced. ' +
        `landStart=${landStart}, landEnd=${landEnd}, landTitleIndex=${landTitleIndex}`,
      )
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
