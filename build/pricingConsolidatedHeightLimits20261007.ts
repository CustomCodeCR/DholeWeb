import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-consolidated-height-limits-20261007'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingConsolidatedHeightLimits20261007] ${label}: expected 1 anchor, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  if (!source.includes('// dhole-consolidated-cargo-20261001')) return source

  let code = source

  code = replaceRequired(
    code,
    `const NON_STACKABLE_BILLABLE_HEIGHT_CM = 266`,
    `const NON_STACKABLE_BILLABLE_HEIGHT_CM = 266
const LAND_CONSOLIDATED_MAX_HEIGHT_CM = 270
const MARITIME_CONSOLIDATED_MAX_HEIGHT_CM = 269`,
    'height limit constants',
  )

  code = replaceRequired(
    code,
    `function cargoLineQuantity(line: ConsolidatedCargoLineUi) {
  return Math.max(1, Math.trunc(number(line.quantity)))
}`,
    `function cargoLineQuantity(line: ConsolidatedCargoLineUi) {
  return Math.max(1, Math.trunc(number(line.quantity)))
}

const consolidatedCargoMaxHeightCm = computed<number | null>(() => {
  if (!consolidatedCargoMode.value) return null

  const equipmentMetadata = metadata(selectedEquipment.value) as (Record<string, unknown> | null)
  const configured = Number(
    equipmentMetadata?.maxCargoHeightCm
    ?? equipmentMetadata?.maxHeightCm
    ?? equipmentMetadata?.cargoMaxHeightCm,
  )
  if (Number.isFinite(configured) && configured > 0) return configured

  if (shipmentModeForApi.value === 'Ltl' || form.modality === 'Land') {
    return LAND_CONSOLIDATED_MAX_HEIGHT_CM
  }

  if (
    shipmentModeForApi.value === 'Lcl'
    && (form.modality === 'Maritime' || form.modality === 'Multimodal')
  ) {
    return MARITIME_CONSOLIDATED_MAX_HEIGHT_CM
  }

  return null
})

function consolidatedCargoMaxHeightForInputUnit(unit: string) {
  const maximumCm = consolidatedCargoMaxHeightCm.value
  if (maximumCm == null) return null
  const normalizedUnit = String(unit ?? '').trim().toLowerCase()
  const value = normalizedUnit === 'in' ? maximumCm / INCH_TO_CM : maximumCm
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function cargoLineExceedsMaximumHeight(line: ConsolidatedCargoLineUi) {
  const maximumCm = consolidatedCargoMaxHeightCm.value
  return maximumCm != null
    && cargoDimensionToCm(line.height) > maximumCm + 0.0001
}

function clampConsolidatedCargoHeights() {
  const maximumCm = consolidatedCargoMaxHeightCm.value
  if (maximumCm == null) return

  for (const line of consolidatedCargoLines.value) {
    if (cargoDimensionToCm(line.height) <= maximumCm + 0.0001) continue
    line.height = cargoDimensionFromCm(maximumCm)
  }
}`,
    'height limit runtime',
  )

  code = replaceRequired(
    code,
    `    && number(line.height) > 0,
  ),`,
    `    && number(line.height) > 0
    && !cargoLineExceedsMaximumHeight(line),
  ),`,
    'height limit ready validation',
  )

  code = replaceRequired(
    code,
    `watch(consolidatedCargoLines, syncConsolidatedCargoForm, { deep: true, immediate: true })`,
    `watch(consolidatedCargoLines, syncConsolidatedCargoForm, { deep: true, immediate: true })
watch(consolidatedCargoLines, clampConsolidatedCargoHeights, { deep: true })
watch(consolidatedCargoMaxHeightCm, clampConsolidatedCargoHeights, { immediate: true })`,
    'height limit watchers',
  )

  const selectableHeightAnchor = `                    <DhInput
                      v-if="usesSelectableCargoUnits"
                      :model-value="miamiDimensionInputValue(line.height)"
                      type="number"
                      min="0"
                      step="0.01"
                      :label="'Alto (' + form.miamiDimensionInputUnit + ')'"
                      @update:model-value="setMiamiDimensionInputValue(line, 'height', $event)"
                    />`
  if (code.includes(selectableHeightAnchor)) {
    code = code.replace(
      selectableHeightAnchor,
      `                    <DhInput
                      v-if="usesSelectableCargoUnits"
                      :model-value="miamiDimensionInputValue(line.height)"
                      type="number"
                      min="0"
                      :max="consolidatedCargoMaxHeightForInputUnit(form.miamiDimensionInputUnit)"
                      step="0.01"
                      :label="'Alto (' + form.miamiDimensionInputUnit + ')'"
                      @update:model-value="setMiamiDimensionInputValue(line, 'height', $event)"
                    />`,
    )
  }

  const standardHeightAnchor = `                    <DhInput v-else v-model.number="line.height" type="number" min="0" step="0.01" :label="'Alto (' + cargoDimensionUnit + ')'" />`
  const baseHeightAnchor = `                    <DhInput v-model.number="line.height" type="number" min="0" step="0.01" :label="'Alto (' + cargoDimensionUnit + ')'" />`
  if (code.includes(standardHeightAnchor)) {
    code = code.replace(
      standardHeightAnchor,
      `                    <DhInput v-else v-model.number="line.height" type="number" min="0" :max="consolidatedCargoMaxHeightForInputUnit(cargoDimensionUnit)" step="0.01" :label="'Alto (' + cargoDimensionUnit + ')'" />`,
    )
  } else if (code.includes(baseHeightAnchor)) {
    code = code.replace(
      baseHeightAnchor,
      `                    <DhInput v-model.number="line.height" type="number" min="0" :max="consolidatedCargoMaxHeightForInputUnit(cargoDimensionUnit)" step="0.01" :label="'Alto (' + cargoDimensionUnit + ')'" />`,
    )
  } else {
    throw new Error('[pricingConsolidatedHeightLimits20261007] height input anchor not found.')
  }

  code = replaceRequired(
    code,
    `                  <p v-if="cargoLineForcedNonStackable(line)" class="mt-2 text-xs font-black text-amber-600">`,
    `                  <p v-if="consolidatedCargoMaxHeightCm" class="mt-2 text-xs font-black text-red-500">
                    Altura máxima permitida: {{ consolidatedCargoMaxHeightCm.toFixed(0) }} cm. El campo no permite superar este límite.
                  </p>
                  <p v-if="cargoLineForcedNonStackable(line)" class="mt-2 text-xs font-black text-amber-600">`,
    'height limit helper copy',
  )

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[pricingConsolidatedHeightLimits20261007] script end not found.')
  code = code.slice(0, scriptEnd) + '\n' + MARKER + '\n' + code.slice(scriptEnd)
  return code
}

export function pricingConsolidatedHeightLimits20261007(): Plugin {
  return {
    name: 'dhole-pricing-consolidated-height-limits-20261007',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
