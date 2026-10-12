import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-air-lcl-freight-per-kg-20261012'

function replaceRequired(source: string, anchor: string, replacement: string) {
  if (!source.includes(anchor)) {
    throw new Error('[pricingAirLclFreightPerKg] Missing wizard anchor: ' + anchor)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
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
    '',
    'function normalizedAirChargeBasis(line: RateLine): ChargeBasis {',
    '  if (!isAirLclFreightContext()) return line.chargeBasis',
    "  if (line.costDetailType === 'Freight') return 'PerKg'",
    "  if (['PerCbm', 'PerChargeableCbm', 'PerCft', 'PerChargeableCft'].includes(line.chargeBasis)) return 'PerKg'",
    '  return line.chargeBasis',
    '}',
    '',
    '// Normalizes new, persisted, coloader and manually entered air-only lines.',
    'watch(',
    '  () => [',
    '    form.modality,',
    '    shipmentModeForApi.value,',
    "    ...rateLines.value.map((line) => line.costDetailType + ':' + line.name + ':' + line.chargeBasis),",
    '  ],',
    '  () => {',
    '    if (!isAirLclFreightContext()) return',
    '    rateLines.value.forEach((line) => {',
    "      if (line.costDetailType === 'Freight') line.name = 'Flete Internacional'",
    '      const basis = normalizedAirChargeBasis(line)',
    '      if (line.chargeBasis !== basis) line.chargeBasis = basis',
    '    })',
    '  },',
    "  { immediate: true, flush: 'sync' },",
    ')',
    '',
    '',
  ].join('\n')

  code = replaceRequired(code, 'function defaultChargeBasis(type: CostDetailType): ChargeBasis {',
    helper + "function defaultChargeBasis(type: CostDetailType): ChargeBasis {\n  if (isAirLclFreightContext() && type === 'Freight') return 'PerKg'")
  code = replaceRequired(code, 'function effectiveChargeBasisForLine(line: RateLine): ChargeBasis {',
    "function effectiveChargeBasisForLine(line: RateLine): ChargeBasis {\n  if (isAirLclFreightContext() && !isFlatPickupLine(line)) return normalizedAirChargeBasis(line)")
  code = replaceRequired(code, 'function quantityForRateLine(line: RateLine) {',
    [
      'function quantityForRateLine(line: RateLine) {',
      '  if (isAirLclFreightContext() && !isFlatPickupLine(line)) {',
      '    const basis = normalizedAirChargeBasis(line)',
      "    if (basis === 'PerKg') return airChargeableWeightKg.value",
      "    if (basis === 'Per100Kg') return airChargeableWeightKg.value / 100",
      "    if (basis === 'PerTon') return airChargeableWeightKg.value / 1000",
      '  }',
    ].join('\n'))

  // No air quote can advance without a positive physical weight.
  code = replaceRequired(code, '    cargoLineQuantity(line) > 0',
    '    cargoLineQuantity(line) > 0\n    && (!isAirLclFreightContext() || number(line.weightKg) > 0)')
  code = replaceRequired(code, ':requested-cbm="lclChargeableCbm"',
    ':requested-cbm="lclChargeableCbm"\n            :requested-weight-kg="airChargeableWeightKg"')
  code = replaceRequired(code, '{{ cargoVolumeUnit }} cobrable',
    "{{ isAirLclFreightContext() ? 'Peso cobrable (kg)' : cargoVolumeUnit + ' cobrable' }}")
  code = replaceRequired(code, '{{ formatCargoVolume(lclChargeableCbm) }}',
    "{{ isAirLclFreightContext() ? airChargeableWeightKg.toFixed(2) + ' kg' : formatCargoVolume(lclChargeableCbm) }}")
  code = code.replaceAll('{{ lclChargeableCbm.toFixed(3) }} CBM cobrable',
    "{{ isAirLclFreightContext() ? airChargeableWeightKg.toFixed(2) + ' kg' : lclChargeableCbm.toFixed(3) + ' CBM' }} cobrable")
  code = code.replaceAll('{{ line.name }}',
    "{{ isAirLclFreightContext() && line.costDetailType === 'Freight' ? 'Flete Internacional' : line.name }}")

  return code
}

export function pricingAirLclFreightPerKg(): Plugin {
  return {
    name: 'dhole-pricing-air-lcl-freight-per-kg',
    enforce: 'post',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
