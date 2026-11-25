import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const source = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
test('transport changes remove equipment and use terminal metadata', () => {
  assert.ok(source.includes("form.value.equipment = []"))
  assert.ok(source.includes("form.value.transportType === 'AIR' ? 'APT'"))
  assert.ok(source.includes('v-if="needsEquipment"'))
  assert.ok(!source.includes('needsEquipment || form.equipment.length'))
  assert.ok(source.includes("selectedRouteType('pol', selectedPol.value) !== routeTerminal.value"))
})
test('new manual openings validate estimated weight and air dimensions without editing actual weight', () => {
  assert.ok(source.includes('positive(form.value.estimatedWeightValue)'))
  assert.ok(source.includes("form.value.lengthCm, form.value.widthCm, form.value.heightCm"))
  assert.ok(source.includes("weightValue: undefined, weightUnit: undefined, weightKg: undefined"))
  assert.ok(source.includes("openingValidationVersion: 3"))
})

test('route and commercial perspective follow Pricing', () => {
  assert.ok(source.includes('operationForClientCountry(clientCountry.value'))
  assert.ok(source.includes('resolveLocationCountryCode(item, currentCatalog'))
  assert.ok(source.includes('v-if="showPod"'))
  assert.ok(source.includes("pod: showPod.value ? form.value.pod : ''"))
  assert.ok(source.includes('PricingInlandServiceLocation'))
})
