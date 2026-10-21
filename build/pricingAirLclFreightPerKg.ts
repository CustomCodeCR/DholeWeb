import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'
const MARKER = '// dhole-air-lcl-freight-per-kg-20261012'

function replaceRequired(source: string, anchor: string, replacement: string) {
  if (!source.includes(anchor)) {
    throw new Error('[pricingAirLclFreightPerKg] Missing wizard anchor: ' + anchor)
  }
  return source.replace(anchor, replacement)
}

export function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  if (!source.includes('const consolidatedTotalWeightKg = computed(')) {
    throw new Error('[pricingAirLclFreightPerKg] Consolidated cargo runtime must run first.')
  }

  let code = source
  const helper = MARKER + '\n' + [
    'function isAirLclFreightContext() {',
    "  return form.modality === 'Air'",
    "    && (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'AirConsol')",
    '}',
    '',
    'const airChargeableWeightKg = computed(() =>',
    '  Math.max(0, number(consolidatedTotalWeightKg.value)),',
    ')',
    "const airChargeUnit = computed(() => form.miamiWeightInputUnit === 'lb' ? 'lb' : 'kg')",
    "const airChargeBasis = computed<ChargeBasis>(() => airChargeUnit.value === 'lb' ? 'PerLb' : 'PerKg')",
    "const airChargeableWeight = computed(() => airChargeUnit.value === 'lb'",
    '  ? airChargeableWeightKg.value * MIAMI_LB_PER_KG : airChargeableWeightKg.value)',
    '',
    'function normalizedAirChargeBasis(line: RateLine): ChargeBasis {',
    '  if (!isAirLclFreightContext()) return line.chargeBasis',
    "  if (line.costDetailType === 'Freight') return airChargeBasis.value",
    "  if (['PerCbm', 'PerChargeableCbm', 'PerCft', 'PerChargeableCft', 'PerKg', 'PerLb'].includes(line.chargeBasis)) return airChargeBasis.value",
    '  return line.chargeBasis',
    '}',
    '',
    '// Normalizes new, persisted, coloader and manually entered air-only lines.',
    'watch(',
    '  () => [',
    '    form.modality,',
    '    shipmentModeForApi.value,',
    '    form.miamiWeightInputUnit,',
    "    ...rateLines.value.map((line) => line.costDetailType + ':' + line.name + ':' + line.chargeBasis),",
    '  ],',
    '  () => {',
    '    if (!isAirLclFreightContext()) return',
    '    rateLines.value.forEach((line) => {',
    "      if (line.costDetailType === 'Freight') line.name = 'Flete Internacional'",
    '      const basis = normalizedAirChargeBasis(line)',
    '      if (line.chargeBasis !== basis) {',
    "        const previousBasis = line.chargeBasis",
    "        // Preserve the total of an existing kg/lb tariff when the user switches units.",
    "        const sourceKg = previousBasis === 'PerKg' ? 1",
    "          : previousBasis === 'PerLb' ? MIAMI_LB_PER_KG",
    "          : previousBasis === 'Per100Kg' ? 0.01",
    "          : previousBasis === 'PerTon' ? 0.001 : null",
    "        if (sourceKg !== null && (basis === 'PerLb' || basis === 'PerKg')) {",
    "          const ratio = sourceKg / (basis === 'PerLb' ? MIAMI_LB_PER_KG : 1)",
    "          line.costAmount = Math.round(number(line.costAmount) * ratio * 1e10) / 1e10",
    "          line.saleAmount = Math.round(number(line.saleAmount) * ratio * 1e10) / 1e10",
    "        }",
    '        line.chargeBasis = basis',
    '      }',
    '    })',
    '  },',
    "  { immediate: true, flush: 'sync' },",
    ')',
    '',
    '',
  ].join('\n')

  code = replaceRequired(code, 'function defaultChargeBasis(type: CostDetailType): ChargeBasis {',
    helper + "function defaultChargeBasis(type: CostDetailType): ChargeBasis {\n  if (isAirLclFreightContext() && type === 'Freight') return airChargeBasis.value")
  code = replaceRequired(code, 'function effectiveChargeBasisForLine(line: RateLine): ChargeBasis {',
    "function effectiveChargeBasisForLine(line: RateLine): ChargeBasis {\n  if (isAirLclFreightContext() && !isFlatPickupLine(line)) return normalizedAirChargeBasis(line)")
  code = replaceRequired(code, 'function quantityForRateLine(line: RateLine) {',
    [
      'function quantityForRateLine(line: RateLine) {',
      '  if (isAirLclFreightContext() && !isFlatPickupLine(line)) {',
      '    const basis = normalizedAirChargeBasis(line)',
      "    if (basis === 'PerKg') return airChargeableWeightKg.value",
      "    if (basis === 'PerLb') return airChargeableWeight.value",
      "    if (basis === 'Per100Kg') return airChargeableWeightKg.value / 100",
      "    if (basis === 'PerTon') return airChargeableWeightKg.value / 1000",
      '  }',
    ].join('\n'))

  // No air quote can advance without a positive physical weight.
  code = replaceRequired(code, '    cargoLineQuantity(line) > 0',
    '    cargoLineQuantity(line) > 0\n    && (!isAirLclFreightContext() || number(line.weightKg) > 0)')
  code = replaceRequired(code, ':requested-cbm="lclChargeableCbm"',
    ':requested-cbm="lclChargeableCbm"\n            :requested-weight-kg="airChargeableWeightKg"\n            :requested-weight-unit="airChargeUnit"')
  code = replaceRequired(code, '{{ cargoVolumeUnit }} cobrable',
    "{{ isAirLclFreightContext() ? 'Peso cobrable (' + airChargeUnit + ')' : cargoVolumeUnit + ' cobrable' }}")
  code = replaceRequired(code, '{{ formatCargoVolume(lclChargeableCbm) }}',
    "{{ isAirLclFreightContext() ? airChargeableWeight.toFixed(2) + ' ' + airChargeUnit : formatCargoVolume(lclChargeableCbm) }}")
  code = code.replaceAll('{{ lclChargeableCbm.toFixed(3) }} CBM cobrable',
    "{{ isAirLclFreightContext() ? airChargeableWeight.toFixed(2) + ' ' + airChargeUnit : lclChargeableCbm.toFixed(3) + ' CBM' }} cobrable")
  code = code.replaceAll('{{ line.name }}',
    "{{ isAirLclFreightContext() && line.costDetailType === 'Freight' ? 'Flete Internacional' : line.name }}")

  return code
}

export function patchSelector(source: string) {
  let code = source

  // Run after the Miami/CFT compatibility plugin; it requires the original
  // markup as an input anchor and still owns the maritime volume selector.
  code = replaceRequired(code,
    '<DhInput :model-value="requestedChargeableDisplay" type="number" :label="requestedChargeableLabel" :disabled="requestedCbmLocked" @update:model-value="updateRequestedChargeableDisplay" />',
    '<DhInput :model-value="isAir ? requestedWeightKg * (requestedWeightUnit === \'lb\' ? 2.20462262 : 1) : requestedChargeableDisplay" type="number" :label="isAir ? \'Peso cobrable (\' + requestedWeightUnit + \')\' : requestedChargeableLabel" :disabled="requestedCbmLocked || isAir" @update:model-value="updateRequestedChargeableDisplay" />',
  )
  code = replaceRequired(code, ':columns="coloaderColumns"',
    ':columns="isAir ? airColoaderColumns : coloaderColumns"')
  code = code.replaceAll('>Flete / CBM</span>',
    ">{{ isAir ? 'Flete / ' + requestedWeightUnit : 'Flete / CBM' }}</span>")
  return code
}

export function pricingAirLclFreightPerKg(): Plugin {
  return {
    name: 'dhole-pricing-air-lcl-freight-per-kg',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (normalized.endsWith(SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      if (normalized.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}
