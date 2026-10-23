import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { pricingWizardScreen7CostChoice } from '../build/pricingWizardScreen7CostChoice.ts'

const wizardPath = '/project/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const fixture = [
  'const rateLines = ref<RateLine[]>([])',
  'function rebuildRateLines() {',
  '  if (pricingDraftRestoring.value) return',
  '}',
  '</script>',
  '<div v-else-if="step === 7" class="crystal-lines-stage space-y-6">',
].join('\n')

function refreshHarness(pricingCosts: Array<Record<string, unknown>>) {
  const plugin = pricingWizardScreen7CostChoice()
  const transform = plugin.transform as unknown as
    (source: string, id: string) => { code: string }
  const patched = transform(fixture, wizardPath).code
  const start = patched.indexOf('function screen7CostLineKey(')
  const end = patched.indexOf('// Only prompt while editing/reloading', start)
  assert.ok(start > 0 && end > start, 'the refreshed wizard function is installed')
  assert.doesNotMatch(patched.slice(start, end), /rateLines\.value\s*=\s*\[\]/,
    'explicit refresh never clears the saved quote before rebuilding')

  const script = ts.transpileModule(patched.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText

  const original = [{
    key: 'existing:D1', detailId: 'D1', costId: 'C1',
    name: 'Cargo en destino', costDetailType: 'DestinationCharge', costType: 'Fixed',
    section: 'destination_charges', currencyId: 'USD', currencyCode: 'USD',
    currencyName: 'USD', costAmount: 100, saleAmount: 120,
    included: true, optional: false, manual: false,
  }, {
    key: 'existing:D2', detailId: 'D2',
    name: 'Gestión manual', costDetailType: 'Other', costType: 'Variable',
    section: 'destination_charges', costAmount: 45, saleAmount: 60,
    included: true, optional: false, manual: true,
  }]
  const events: string[] = []
  const env: Record<string, any> = {
    props: { viewOnly: false },
    screen7RefreshBusy: { value: false },
    screen7RefreshAllowed: { value: false },
    screen7RefreshPromptOpen: { value: true },
    rateLines: { value: original.map((line) => ({ ...line })) },
    costs: { value: [] },
    pricingDraftLastLineContext: 'normal-context',
    selectedCurrency: { value: { id: 'USD', code: 'USD', value: 'Dólares' } },
    catalogs: { currencies: [] },
    pricingDraftLineContextKey: () => 'normal-context',
    loadApplicableCosts: async () => { env.costs.value = pricingCosts },
    loadAllApplicableOptionalCosts: async () => [],
    isOwnLclMatrixContext: () => false,
    isLclColoaderAgentCostContext: () => false,
    currentCostContextKey: () => 'route-and-agent',
    PricingService: {
      selectCosts: async () => pricingCosts,
    },
    rebuildRateLines: () => { env.rateLines.value = [] },
    number: (v: unknown) => Number(v) || 0,
    resolvedConditionalCost: (cost: any) => ({
      costAmount: cost.costAmount, saleAmount: cost.saleAmount,
    }),
    sectionForCost: () => 'destination_charges',
    costContextLabel: () => '',
    defaultChargeBasis: () => 'PerShipment',
    displayValue: (currency: any) => currency.value,
    enforceLineCurrency: () => {},
    normalizeCatalogValue: (v: unknown) => String(v ?? '').toLowerCase(),
    visibleSections: { value: ['destination_charges'] },
    hasInternationalTransportService: { value: true },
    savePricingDraftNow: () => events.push('saved'),
    toastStore: {
      success: () => events.push('success'),
      warning: () => events.push('warning'),
      backendError: (error: Error) => { throw error },
    },
  }
  const ctx = vm.createContext(env)
  vm.runInContext(script + '\nthis.runRefresh = applyScreen7DatabaseCosts', ctx)
  return { env, events, runRefresh: ctx.runRefresh as () => Promise<void> }
}

test('screen 7 refreshes a persisted cost even when the wizard generates zero lines', async () => {
  const active = [{
    id: 'C1', name: 'Cargo en destino', costDetailType: 'DestinationCharge',
    costType: 'Fixed', chargeBasis: 'PerShipment', isActive: true,
    currencyId: 'USD', currencyCode: 'USD', currencyName: 'USD',
    costAmount: 135, saleAmount: 175,
  }]
  const { env, events, runRefresh } = refreshHarness(active)
  await runRefresh()
  assert.equal(env.rateLines.value.length, 2)
  assert.equal(env.rateLines.value[0].detailId, 'D1')
  assert.equal(env.rateLines.value[0].costAmount, 135)
  assert.equal(env.rateLines.value[0].saleAmount, 175)
  assert.equal(env.rateLines.value[1].detailId, 'D2')
  assert.equal(env.rateLines.value[1].costAmount, 45)
  assert.equal(env.rateLines.value[1].saleAmount, 60)
  assert.equal(env.screen7RefreshPromptOpen.value, false)
  assert.deepEqual(events, ['saved', 'success'])
})

test('screen 7 preserves every persisted line if Pricing returns no matching amounts', async () => {
  const { env, events, runRefresh } = refreshHarness([])
  await runRefresh()
  assert.equal(env.rateLines.value.length, 2)
  assert.equal(env.rateLines.value[0].costAmount, 100)
  assert.equal(env.rateLines.value[1].costAmount, 45)
  assert.deepEqual(events, ['saved', 'warning'])
})
