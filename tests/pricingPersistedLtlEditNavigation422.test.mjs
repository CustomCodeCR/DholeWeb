import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { patchPersistedLandLtlEditNavigation422, patchPersistedLclEditNavigation } from '../build/pricingP7Reconcile391.ts'

const template = [
  'async function next() {',
  '  if (!canNext.value) return',
  '  step.value = 7',
  '}',
  'function previous() {}',
].join('\n')

function makeNext({ rateId = 'saved-rate-id', mode = 'Ltl', viewOnly = false,
  sellerRequestMode = false, editing = true, hydrating = false } = {}) {
  const modified = patchPersistedLandLtlEditNavigation422(template)
  const snippet = modified.slice(0, modified.indexOf('\nfunction previous()'))
  const step = { value: 6 }
  const canNext = { value: false }
  const props = { rateId, viewOnly, sellerRequestMode }
  const editingRate = { value: editing ? { id: rateId, rateDetails: [
    { id: 'saved-detail', costAmount: 42.666667, saleAmount: 55 },
  ] } : null }
  const persisted = editingRate.value?.rateDetails
  // Execute the generated next() function; do not mock away the blocked click.
  const next = new Function(
    'step', 'canNext', 'props', 'editingRate', 'shipmentModeForApi',
    'hydratingExistingRate', 'return ' + snippet,
  )(step, canNext, props, editingRate, { value: mode }, { value: hydrating })
  return { next, step, persisted, editingRate }
}

test('DH-422: saved own LTL advances from P6 to P7 despite canNext=false', async () => {
  const model = makeNext()
  const original = structuredClone(model.persisted)
  await model.next()
  assert.equal(model.step.value, 7)
  assert.deepEqual(model.editingRate.value.rateDetails, original,
    'navigation must not reprice or remove persisted freight details')
})

test('DH-422: new LTL, another mode, view-only and Sales do not bypass rules', async () => {
  for (const options of [
    { rateId: null }, { mode: 'Fcl' }, { mode: 'Lcl' },
    { viewOnly: true }, { sellerRequestMode: true }, { editing: false },
  ]) {
    const model = makeNext(options)
    await model.next()
    assert.equal(model.step.value, 6, JSON.stringify(options))
  }
})

test('DH-422: incomplete hydration does not open P7 prematurely', async () => {
  const model = makeNext({ hydrating: true })
  await model.next()
  assert.equal(model.step.value, 6)
})

test('DH-422: final Vite transform rewrites navigation after legacy checks', () => {
  const source = readFileSync(
    new URL('../build/pricingP7Reconcile391.ts', import.meta.url), 'utf8')
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  const old = vite.indexOf('pricingRequiredFieldFinalFeedback(),')
  const after = vite.indexOf('pricingP7Reconcile391(),')
  const vue = vite.indexOf('    vue(),')
  assert.ok(old >= 0 && after > old && vue > after,
    'final patch must run AFTER legacy P6 validation and before Vue compile')
  assert.match(source, /return patchPersistedLandLtlEditNavigation422\(code\)/)
  const result = patchPersistedLandLtlEditNavigation422(template)
  assert.ok(result.indexOf("shipmentModeForApi.value === 'Ltl'") <
    result.indexOf('if (!canNext.value)'),
    'saved quotation exception must precede the old canNext guard')
  assert.equal((result.match(/async function next\(\) \{/g) ?? []).length, 1)
  // Existing P7 micro-fixtures have no navigation; the real wizard does.
  assert.equal(patchPersistedLandLtlEditNavigation422('cost fixture'), 'cost fixture')
  assert.throws(() => patchPersistedLandLtlEditNavigation422('const step = ref(1)'), /Expected one wizard next/)
  const actualWizard = readFileSync(
    new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
    'utf8',
  )
  const productionNext = patchPersistedLandLtlEditNavigation422(actualWizard)
  const realNext = productionNext.slice(
    productionNext.indexOf('async function next() {'),
    productionNext.indexOf('function previous() {', productionNext.indexOf('async function next() {')),
  )
  assert.ok(realNext.includes("shipmentModeForApi.value === 'Ltl'"))
  assert.ok(realNext.indexOf("shipmentModeForApi.value === 'Ltl'") < realNext.indexOf('if (!canNext.value)'))
})

const lclFixture = template + '\nasync function quoteEditApplyDelta387() {}'
function makeLclNext({ rateId = 'saved-rate-id', mode = 'Lcl', viewOnly = false,
  sellerRequestMode = false, editing = true, hydrating = false,
  agentId = 'coloader', currencyId = 'USD', freightCost = 2.8135, freightSale = 3.15,
  deltaReady = true } = {}) {
  const modified = patchPersistedLclEditNavigation(lclFixture)
  const snippet = modified.slice(0, modified.indexOf('\nfunction previous()'))
  const step = { value: 6 }
  const props = { rateId, viewOnly, sellerRequestMode }
  const editingRate = { value: editing ? { id: rateId, rateDetails: [
    { id: 'saved-freight', costAmount: 2.8135, saleAmount: 3.15 },
  ] } : null }
  const form = { agentId, currencyId, freightCost, freightSale, carrierId: '' }
  const warnings = []
  let deltaCalls = 0
  const next = new Function('step', 'canNext', 'props', 'editingRate', 'shipmentModeForApi',
    'hydratingExistingRate', 'form', 'toastStore', 'quoteEditApplyDelta387', 'return ' + snippet)(
    step, { value: false }, props, editingRate, { value: mode }, { value: hydrating }, form,
    { warning: (...args) => warnings.push(args) }, async () => { deltaCalls++; return deltaReady },
  )
  return { next, step, editingRate, form, warnings, deltaCalls: () => deltaCalls }
}

test('LCL edit: P6 proceeds without a carrier or new tariff selection and preserves saved details', async () => {
  const model = makeLclNext()
  const original = structuredClone(model.editingRate.value.rateDetails)
  await model.next()
  assert.equal(model.step.value, 7)
  assert.equal(model.deltaCalls(), 1)
  assert.deepEqual(model.editingRate.value.rateDetails, original)
  assert.equal(model.form.carrierId, '')
  assert.equal(model.form.freightCost, 2.8135)
})

test('LCL edit: new quote, other modes, view-only, Sales and hydration retain original guards', async () => {
  for (const options of [{ rateId: null }, { mode: 'Fcl' }, { viewOnly: true },
    { sellerRequestMode: true }, { editing: false }, { hydrating: true }]) {
    const model = makeLclNext(options)
    await model.next()
    assert.equal(model.step.value, 6, JSON.stringify(options))
    assert.equal(model.deltaCalls(), 0)
  }
})

test('LCL edit: missing provider/currency or invalid freight does not bypass validation', async () => {
  for (const options of [{ agentId: '' }, { currencyId: '' }, { freightCost: -1 },
    { freightSale: NaN }]) {
    const model = makeLclNext(options)
    await model.next()
    assert.equal(model.step.value, 6)
    assert.equal(model.deltaCalls(), 0)
    assert.equal(model.warnings.length, 1)
  }
})

test('LCL edit: unsuccessful cost reconciliation is visible and does not advance', async () => {
  const model = makeLclNext({ deltaReady: false })
  await model.next()
  assert.equal(model.step.value, 6)
  assert.equal(model.deltaCalls(), 1)
  assert.equal(model.warnings.length, 1)
})

test('LCL edit: the final combined transform installs the guard ahead of old validation', () => {
  const result = patchPersistedLandLtlEditNavigation422(lclFixture)
  assert.ok(result.indexOf("shipmentModeForApi.value === 'Lcl'") < result.indexOf('if (!canNext.value)'))
  assert.match(result, /await quoteEditApplyDelta387\(\)/)
})
