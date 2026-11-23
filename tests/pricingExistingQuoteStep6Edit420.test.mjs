import assert from 'node:assert/strict'
import test from 'node:test'
import { pricingRequiredFieldFinalFeedback } from '../build/pricingRequiredFieldFinalFeedback.ts'

const wizardFixture = [
  'const canNext = computed(() => {',
  '  if (step.value === 6) return false',
  '  return true',
  '})',
  'const requiredStepIssues = computed(() => {',
  '  if (step.value === 6) {',
  "    add(!form.agentId, 'agentId', shipmentModeForApi.value === 'Lcl' ? 'Agente / coloader' : 'Agente')",
  '  }',
  '})',
  'async function next() {',
  '  // Persisted quotations must be able to review their saved lines.',
  '  if (props.rateId) {',
  '    if (step.value < maxStep.value) step.value += 1',
  '    return',
  '  }',
  '  if (!canNext.value) return',
  '}',
  'async function saveOpenRequest() {',
  '}',
  'async function saveRate() {',
  '}',
  'function validateCargoBeforeSaving() {',
  '}',
  '  if (step.value === 5 && !props.rateId) {',
  '  }',
  '<section class="crystal-panel"></section>',
  '<DhButton :disabled="!canNext" @click="next">Continuar <ChevronRight class="h-4 w-4" /></DhButton>',
  '<PricingLocationSearchSelect v-model="form.podId" label="POD" :optional="true" />',
].join('\n')

function transformFixture() {
  const plugin = pricingRequiredFieldFinalFeedback()
  assert.equal(typeof plugin.transform, 'function')
  const result = plugin.transform(wizardFixture, '/fixture/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.ok(result && typeof result === 'object' && typeof result.code === 'string')
  return result.code
}

test('DH-420: P6 to P7 navigation of an existing quote bypasses new-quote required fields', () => {
  const result = transformFixture()
  const next = result.split('async function next() {')[1].split('async function saveOpenRequest() {')[0]
  for (const guard of [
    'if (!props.rateId && !props.viewOnly && !validateRequiredFields()) return',
    'if (!props.rateId && !props.viewOnly && !requirements20260908Ready.value)',
    'if (!props.rateId && !props.viewOnly && !canNext.value)',
  ]) {
    assert.ok(next.includes(guard), 'Missing creation-only navigation guard: ' + guard)
  }
  assert.match(next, /if \(props\.rateId\) \{[\s\S]*?step\.value \+= 1[\s\S]*?return/)
  assert.ok(next.indexOf('if (props.rateId) {') > next.indexOf('if (!props.rateId && !props.viewOnly && !canNext.value)'))
  assert.doesNotMatch(next, /if \(!props\.viewOnly && !canNext\.value\)/)
})

test('DH-420: new quotes still validate provider and saving still validates cargo', () => {
  const result = transformFixture()
  assert.match(result, /const ltlSourceReady =/)
  assert.match(result, /!props\.rateId && !props\.viewOnly && !validateRequiredFields\(\)/)
  assert.match(result, /async function saveRate\(\) \{\n  if \(!validateMaritimePodBeforeSaving\(\) \|\| !validateCargoBeforeSaving\(\)\) return/)
  assert.match(result, /function validateCargoBeforeSaving\(\) \{[\s\S]*fclMissingUnitCount/)
})
