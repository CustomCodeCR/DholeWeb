import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardLclCorrections] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const visibleTitlesAnchor = "const visibleStepTitles = computed(() => props.viewOnly ? [...stepTitles, 'Vista completa'] : stepTitles)"
  const visibleTitlesReplacement = `const visibleStepTitles = computed(() => {\n  const titles = [...stepTitles]\n  if (['LCL', 'LTL'].includes(form.shipmentMode.trim().toUpperCase())) titles[2] = 'Ruta'\n  return props.viewOnly ? [...titles, 'Vista completa'] : titles\n})`
  code = replaceOne(code, visibleTitlesAnchor, visibleTitlesReplacement, 'dynamic LCL step title')

  const selectedEquipmentAnchor = 'const selectedEquipment = computed(() => findById(equipmentSource.value, form.equipmentId))'
  const selectedEquipmentReplacement = `const selectedEquipment = computed(() => {\n  const selected = findById(equipmentSource.value, form.equipmentId)\n  const consolidatedMode = form.shipmentMode.trim().toUpperCase()\n  if (selected || !['LCL', 'LTL'].includes(consolidatedMode)) return selected\n\n  // LCL/LTL are consolidated cargo and must not require the user to choose a\n  // container or trailer. Keep a legacy catalog snapshot internally only for\n  // CreateRate contract compatibility; Pricing removes it from commercial data.\n  const consolidatedEquipment = equipmentSource.value.find((item) => {\n    const meta = metadata(item)\n    const modes = Array.isArray(meta?.shipmentModes) ? meta.shipmentModes : []\n    const text = normalizeCatalogValue([item.code, item.slug, item.label, displayValue(item)].filter(Boolean).join(' '))\n    return modes.some((mode) => String(mode).trim().toUpperCase() === consolidatedMode)\n      || text.includes(consolidatedMode.toLowerCase())\n      || text.includes('consolid')\n      || text.includes('loose')\n  })\n\n  return consolidatedEquipment\n    ?? equipmentSource.value[0]\n    ?? (consolidatedMode === 'LCL' ? catalogs.containers[0] : catalogs.landEquipmentTypes[0])\n    ?? null\n})`
  code = replaceOne(code, selectedEquipmentAnchor, selectedEquipmentReplacement, 'internal LCL equipment resolver')

  const canNextEquipmentAnchor = `      selectedEquipment.value &&\n      form.equipmentQuantity > 0 &&`
  const canNextEquipmentReplacement = `      (['Lcl', 'Ltl'].includes(shipmentModeForApi.value) || (selectedEquipment.value && form.equipmentQuantity > 0)) &&`
  code = replaceOne(code, canNextEquipmentAnchor, canNextEquipmentReplacement, 'LCL route validation without equipment')

  const step3HeadingAnchor = `            <h2 class="crystal-title">{{ form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>`
  const step3HeadingReplacement = `            <h2 class="crystal-title">{{ ['Lcl', 'Ltl'].includes(shipmentModeForApi) ? 'Ruta, Incoterm y servicios' : form.modality === 'Land' ? 'Ruta, furgón, Incoterm y servicios' : 'Ruta, equipo, Incoterm y servicios' }}</h2>`
  code = replaceOne(code, step3HeadingAnchor, step3HeadingReplacement, 'Pantalla 3 LCL heading')

  const equipmentBlockAnchor = `            <!-- Fila 3: tamaño, tipo y cantidad del equipo. -->\n            <div class="grid gap-4 md:grid-cols-3">`
  const equipmentBlockReplacement = `            <!-- Fila 3: equipo aplica solamente a FCL/FTL. LCL/LTL se cotizan como carga consolidada. -->\n            <div v-if="!['Lcl', 'Ltl'].includes(shipmentModeForApi)" class="grid gap-4 md:grid-cols-3">`
  code = replaceOne(code, equipmentBlockAnchor, equipmentBlockReplacement, 'hide LCL equipment fields')

  const routeSummaryAnchor = `          <div v-if="selectedEquipment || direction" class="crystal-route-summary">\n            <div>\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Operación</span>\n              <strong class="mt-1 block text-sm">{{ direction || 'Por determinar' }}</strong>\n            </div>\n            <div v-if="selectedEquipment">\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ form.modality === 'Land' ? 'Furgón' : 'Equipo' }}</span>\n              <strong class="mt-1 block text-sm">{{ displayValue(selectedEquipment) }}</strong>\n            </div>\n            <div>\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Servicios</span>\n              <strong class="mt-1 block text-sm">{{ selectedServices.length }}</strong>\n            </div>\n          </div>`
  const routeSummaryReplacement = `          <div v-if="selectedEquipment || direction" class="crystal-route-summary">\n            <div>\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Operación</span>\n              <strong class="mt-1 block text-sm">{{ direction || 'Por determinar' }}</strong>\n            </div>\n            <div v-if="!['Lcl', 'Ltl'].includes(shipmentModeForApi) && selectedEquipment">\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ form.modality === 'Land' ? 'Furgón' : 'Equipo' }}</span>\n              <strong class="mt-1 block text-sm">{{ displayValue(selectedEquipment) }}</strong>\n            </div>\n            <div>\n              <span class="block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">Servicios</span>\n              <strong class="mt-1 block text-sm">{{ selectedServices.length }}</strong>\n            </div>\n          </div>`
  code = replaceOne(code, routeSummaryAnchor, routeSummaryReplacement, 'LCL route context summary')

  const summaryAnchor = `{{ direction }} · {{ form.modality }} · {{ form.shipmentMode }} · {{ displayValue(selectedEquipment) }} · {{ displayValue(selectedIncoterm) }}`
  const summaryReplacement = `{{ [direction, form.modality, form.shipmentMode, ['Lcl', 'Ltl'].includes(shipmentModeForApi) ? null : displayValue(selectedEquipment), displayValue(selectedIncoterm)].filter(Boolean).join(' · ') }}`
  code = replaceOne(code, summaryAnchor, summaryReplacement, 'LCL summary without equipment')

  return code
}

export function pricingWizardLclCorrections(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-corrections',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}
