import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPersistedFtlEditNavigation } from '../build/pricingP7Reconcile391.ts'

const fixture = [
  'const persistedFtlAgentForEdit = computed(() => null)',
  'async function quoteEditApplyDelta387() {}',
  'async function next() { return false }',
  'function previous() {}',
].join('\n')

test('saved FTL P6 enters P7 with historical agent even if catalog reconciliation fails', async () => {
  const output = patchPersistedFtlEditNavigation(fixture)
  const next = output.slice(output.indexOf('async function next()'), output.indexOf('function previous()'))
  const run = new Function('step','props','editingRate','form','shipmentModeForApi','hydratingExistingRate','persistedFtlAgentForEdit','quoteEditApplyDelta387','toastStore','syncPersistedFreightLineForEdit', next + '\nreturn next')
  const step = { value: 6 }
  const form = { modality: 'Land', agentId: '', currencyId: 'USD', freightCost: 1600, freightSale: 1695 }
  const props = { rateId: 'quote', viewOnly: false, sellerRequestMode: false }
  const messages = []
  let synced = 0
  const nav = run(step, props, {value: {}}, form, {value: 'Ftl'}, {value: false}, {value: {id: 'saved-gcf'}},
    async () => false, {warning: (...args) => messages.push(args), backendError: (...args) => messages.push(args)}, () => {synced++})
  await nav()
  assert.equal(step.value, 7)
  assert.equal(form.agentId, 'saved-gcf')
  assert.equal(synced, 1)
  assert.equal(messages.length, 1)
  step.value = 6
  form.agentId = 'new-agent'
  await nav()
  assert.equal(form.agentId, 'new-agent')
  assert.equal(step.value, 7)
  step.value = 6
  form.freightCost = -1
  await nav()
  assert.equal(step.value, 6)
  form.freightCost = 1600
  props.rateId = ''
  await nav()
  assert.equal(step.value, 6)
})
test('standalone fixtures without FTL runtime remain unchanged', () => {
  assert.equal(patchPersistedFtlEditNavigation('async function next() {}'), 'async function next() {}')
})
