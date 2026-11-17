import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { patchPricingLclNoCarrierCostGuard } from '../build/pricingLclNoCarrierCostGuard.ts'

const fixture = [
  'function resolvedConditionalCost(cost: CostSelectDto) { return cost }',
  'function applicableCost(cost: CostSelectDto) { return true }',
  'function screen7CostMatchesSelectedProviders(cost: CostSelectDto) { return true }',
].join('\n')

function harness(mode = 'Lcl', modality = 'Maritime') {
  const patched = patchPricingLclNoCarrierCostGuard(fixture)
  const compiled = ts.transpileModule(patched, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const env: Record<string, any> = {
    form: { modality }, shipmentModeForApi: { value: mode },
  }
  const context = vm.createContext(env)
  vm.runInContext(compiled + '\nthis.check = { regular: applicableCost, amount: resolvedConditionalCost, refresh: screen7CostMatchesSelectedProviders }', context)
  return env.check as { regular: (cost: any) => boolean, amount: (cost: any) => any, refresh: (cost: any) => boolean }
}

test('maritime LCL rejects MAERSK by carrier ID, multiple relations or legacy label at all selection gates', () => {
  const h = harness()
  const shippingLineCosts = [
    { id: 'maersk', carrierId: 'maersk-uuid' },
    { id: 'maersk-multi', carriers: [{ id: 'maersk-uuid', name: 'MAERSK' }] },
    { id: 'maersk-legacy', carrierName: 'MAERSK' },
    { id: 'maersk-legacy-code', carrierCode: 'MSK' },
  ]
  for (const cost of shippingLineCosts) {
    assert.equal(h.regular(cost), false)
    assert.equal(h.amount(cost), null)
    assert.equal(h.refresh(cost), false)
  }
})

test('LCL preserves generic and coloader-agent charges with no naviera', () => {
  const h = harness()
  const cost = { id: 'handling-coloader', agentId: 'wwl', agentName: 'WWL', carriers: [] }
  assert.equal(h.regular(cost), true)
  assert.equal(h.amount(cost), cost)
  assert.equal(h.refresh(cost), true)
})

test('FCL and air cargo keep their carrier configuration unaffected', () => {
  const maersk = { id: 'maersk', carrierId: 'maersk-uuid' }
  for (const h of [harness('Fcl'), harness('Lcl', 'Air'), harness('AirConsol', 'Air')]) {
    assert.equal(h.regular(maersk), true)
    assert.equal(h.amount(maersk), maersk)
    assert.equal(h.refresh(maersk), true)
  }
})

test('final guard is idempotent, narrow and registered after prior pricing transforms before Vue', () => {
  const source = patchPricingLclNoCarrierCostGuard(fixture)
  assert.equal(patchPricingLclNoCarrierCostGuard(source), source)
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  const pluginCall = vite.lastIndexOf('pricingLclNoCarrierCostGuard(),')
  const priorPlugin = vite.lastIndexOf('pricingPanamaFclOverweight(),')
  const vue = vite.lastIndexOf('vue(),')
  assert.ok(pluginCall > priorPlugin && vue > pluginCall)
})

test('the legacy edit wizard receives the same maritime LCL no-naviera rule', () => {
  const stableSource = fixture.split('\n').slice(0, 2).join('\n')
  const patched = patchPricingLclNoCarrierCostGuard(stableSource, false)
  assert.match(patched, /lclNoCarrierRejectCatalogCost\(cost\)/)
  assert.match(patched, /function applicableCost\(cost: CostSelectDto\)/)
  assert.doesNotMatch(patched, /function screen7CostMatchesSelectedProviders/)
})
