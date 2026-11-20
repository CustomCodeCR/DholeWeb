import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(
  new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url),
  'utf8',
)

function between(begin: string, end: string) {
  const from = source.indexOf(begin)
  const to = source.indexOf(end, from + begin.length)
  assert.ok(from >= 0 && to > from, 'Missing source boundary: ' + begin)
  return source.slice(from, to)
}

const helper = between(
  'async function dholeMergeScreen7OptionalCostsForComparison(',
  '\n// Re-read Costos y recargos whenever',
)
const watcher = between(
  'watch(\n  () => [step.value, currentCostContextKey()].join',
  '\n\n`\n\nconst SCREEN6',
)

function runSource(code: string, context: Record<string, unknown>, name: string) {
  const js = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return vm.runInNewContext(js + '\n' + name, context) as any
}

function fixture() {
  const merchant = {
    id: 'INLAND_BALBOA_CFZ',
    name: 'Inland de Balboa a Colon Free Zone (Merchant)',
    costType: 'Optional',
    costDetailType: 'DestinationCharge',
    chargeBasis: 'PerContainer',
    operationalConditions: ['MerchantHaulage'],
    costAmount: 400,
    saleAmount: 450,
  }
  const state = {
    context: 'FCL|BALBOA|COLON_FREE_ZONE|MAERSK',
    queried: 0,
    syncCount: 0,
    costs: { value: [] as typeof merchant[] },
    step: { value: 6 },
    form: { merchantHaulage: false, carrierHaulage: false },
    dholeHaulageVisible: { value: true },
    dholeHaulagePending: { value: false },
    dholeHaulageLoadedContext: { value: '' },
    dholeHaulageRequestVersion: 0,
    props: { viewOnly: false },
    toastStore: { backendError: (error: unknown) => { throw error } },
    selected: [merchant],
    currentCostContextKey: () => state.context,
    loadApplicableCosts: async () => { state.queried++; state.costs.value = []; return true },
    loadAllApplicableOptionalCosts: async () => state.selected,
    syncHaulageOptionalLines: () => { state.syncCount++ },
    get dholeMerchantAvailable() {
      return { value: state.costs.value.some((row) => row.id === merchant.id) }
    },
    dholeCarrierAvailable: { value: false },
    dholeHaulageRecommended: { value: 'merchant' },
    watch: (_source: unknown, cb: () => Promise<void>) => { state.callback = cb },
    callback: null as null | (() => Promise<void>),
  }

  const environment = {
    ...state,
    // These objects are shared by reference between the VM and test.
    costs: state.costs,
    step: state.step,
    form: state.form,
    dholeHaulageVisible: state.dholeHaulageVisible,
    dholeHaulagePending: state.dholeHaulagePending,
    dholeHaulageLoadedContext: state.dholeHaulageLoadedContext,
    props: state.props,
    currentCostContextKey: state.currentCostContextKey,
    loadApplicableCosts: state.loadApplicableCosts,
    loadAllApplicableOptionalCosts: state.loadAllApplicableOptionalCosts,
    syncHaulageOptionalLines: state.syncHaulageOptionalLines,
    toastStore: state.toastStore,
    dholeHaulageRecommended: state.dholeHaulageRecommended,
    get dholeMerchantAvailable() { return state.dholeMerchantAvailable },
    dholeCarrierAvailable: state.dholeCarrierAvailable,
    watch: (_expr: unknown, cb: () => Promise<void>) => { state.callback = cb },
  }

  // Evaluate the loader and watcher in the same lexical module, matching Vue.
  const combined = 'let dholeHaulageRequestVersion = 0;\\n' + helper + '\\n' + watcher
  const merge = runSource(combined, environment, 'dholeMergeScreen7OptionalCostsForComparison')
  return { state, environment, merchant, merge, callback: () => state.callback?.() }
}

test('Screen 6 loads the same filtered Optional Merchant catalog that Screen 7 shows', async () => {
  const { state, merchant, callback } = fixture()
  await callback()
  assert.equal(state.queried, 1)
  assert.equal(state.costs.value.length, 1)
  assert.equal(state.costs.value[0]?.id, merchant.id)
  assert.equal((state.costs.value[0] as any).__dholePricingContextKey, state.context)
  assert.equal(state.form.merchantHaulage, true)
  assert.equal(state.form.carrierHaulage, false)
  assert.equal(state.syncCount, 1)
  assert.equal(state.dholeHaulagePending.value, false)
})

test('A changed route must never receive stale optional Merchant costs', async () => {
  const { state, environment, merchant, merge } = fixture()
  let release!: (rows: typeof merchant[]) => void
  const pending = new Promise<typeof merchant[]>((resolve) => { release = resolve })
  environment.loadAllApplicableOptionalCosts = () => pending
  const task = merge(state.context, 0)
  state.context = 'FCL|RODMAN|SAN_JOSE|MAERSK'
  release([merchant])
  assert.equal(await task, false)
  assert.equal(state.costs.value.length, 0)
})

test('A stale request serial must never overwrite the latest quotation context', async () => {
  const { state, environment, merge } = fixture()
  // No watcher ran yet: the current request serial is 0.
  assert.equal(await merge(state.context, 1), false)
  assert.equal(state.costs.value.length, 0)
})

test('Regression: Screen 6 no longer calculates empty Merchant before Optional fetch', () => {
  assert.match(source, /await dholeMergeScreen7OptionalCostsForComparison\(requestedContext, requestVersion\)/)
  assert.match(source, /await loadAllApplicableOptionalCosts\(\)/)
  assert.match(source, /\!loaded\s*\|\| requestVersion !== dholeHaulageRequestVersion/)
})
