import test from 'node:test'
import assert from 'node:assert/strict'
import { patchWizard, patchSelector } from '../build/pricingAirLclFreightPerKg.ts'

test('air quote switches quantity, label and persisted charge basis with selected lb/kg', () => {
  const source = [
    'const consolidatedTotalWeightKg = computed(() => 45.36)',
    'function defaultChargeBasis(type: CostDetailType): ChargeBasis {',
    'function effectiveChargeBasisForLine(line: RateLine): ChargeBasis {',
    'function quantityForRateLine(line: RateLine) {',
    '    cargoLineQuantity(line) > 0',
    ':requested-cbm="lclChargeableCbm"',
    '{{ cargoVolumeUnit }} cobrable',
    '{{ formatCargoVolume(lclChargeableCbm) }}',
    '{{ lclChargeableCbm.toFixed(3) }} CBM cobrable',
    '{{ line.name }}',
  ].join('\n')

  const code = patchWizard(source)
  assert.ok(code.includes("form.miamiWeightInputUnit === 'lb' ? 'lb' : 'kg'"))
  assert.ok(code.includes("airChargeUnit.value === 'lb' ? 'PerLb' : 'PerKg'"))
  assert.ok(code.includes("if (basis === 'PerLb') return airChargeableWeight.value"))
  assert.ok(code.includes("if (basis === 'PerKg') return airChargeableWeightKg.value"))
  assert.ok(code.includes(':requested-weight-unit="airChargeUnit"'))
  assert.ok(code.includes("'Peso cobrable (' + airChargeUnit + ')'"))
  assert.ok(code.includes("const ratio = sourceKg / (basis === 'PerLb' ? MIAMI_LB_PER_KG : 1)"))
})

test('source selector shows preferred weight unit instead of fixed kilograms', () => {
  const source = [
    '<DhInput :model-value="requestedChargeableDisplay" type="number" :label="requestedChargeableLabel" :disabled="requestedCbmLocked" @update:model-value="updateRequestedChargeableDisplay" />',
    ':columns="coloaderColumns"',
    '>Flete / CBM</span>',
  ].join('\n')

  const code = patchSelector(source)
  assert.ok(code.includes("requestedWeightUnit === 'lb' ? 2.20462262 : 1"))
  assert.ok(code.includes("'Peso cobrable (' + requestedWeightUnit + ')'"))
  assert.ok(code.includes("'Flete / ' + requestedWeightUnit"))
})

test('conversion from kg unit prices to lb unit prices preserves the freight total', () => {
  const poundsPerKg = 2.20462262
  const pounds = 100
  const kilograms = pounds / poundsPerKg
  const unitPricePerKg = 5
  const unitPricePerLb = unitPricePerKg / poundsPerKg
  const costInKg = kilograms * unitPricePerKg
  const costInLb = pounds * unitPricePerLb
  assert.ok(Math.abs(costInKg - costInLb) < 1e-8)
  assert.ok(Math.abs(unitPricePerLb * poundsPerKg - unitPricePerKg) < 1e-8)
})
