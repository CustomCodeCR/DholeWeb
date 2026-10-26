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

function refreshHarness(pricingCosts: Array<Record<string, unknown>>, own = false) {
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
    form: { freightCost: 0, freightSale: 0, miamiCommercialPlan: null, cargoValue: 0,
      miamiWhsQty: 1, miamiIncludeSed: true, miamiSedQty: 1, dangerousCargo: false,
      miamiBonded: false },
    editingRate: { value: { chargeableQuantity: 29 } },
    selectedOrigin: { value: { code: 'CNSHA', name: 'Shanghai, China' } },
    selectedDestination: { value: { name: 'Balboa, Panamá' } },
    resolvePodForDestination: () => ({ name: 'San Jose, Costa Rica' }),
    selectedIncotermCode: { value: 'FOB' },
    lclSelectedSourceKey: { value: 'Own:11111111-1111-4111-8111-111111111111' },
    lclSelectedSource: { value: null },
    lclRequestedCbm: { value: 29 },
    lclCargoLines: { value: [{ description: 'Carga LCL', units: 1, totalWeightKg: 0,
      lengthCm: 100, widthCm: 100, heightCm: 2900 }] },
    screen7OwnLclRefreshContext: { value: '' },
    persistedOwnLclConsolidationId: () => '11111111-1111-4111-8111-111111111111',
    OwnLclConsolidationService: {
      get: async () => ({ polCode: 'CNSHA', polName: 'Shanghai' }),
      calculate: async () => ({
        consolidationId: '11111111-1111-4111-8111-111111111111',
        consolidationNumber: 54, matrixVersion: 'matrix-current',
        lines: [
          { name: 'Flete internacional', chargeBasis: 'CBM', quantity: 29,
            costUnit: 165, saleUnit: 172, costTotal: 4785, saleTotal: 4988 },
          { name: 'Zone Charge', chargeBasis: 'HBL', quantity: 1,
            costUnit: 10, saleUnit: 50, costTotal: 10, saleTotal: 50 },
          { name: 'DMCE', chargeBasis: 'HBL', quantity: 1,
            costUnit: 65, saleUnit: 75, costTotal: 65, saleTotal: 75 },
          { name: 'Manejos', chargeBasis: 'HBL', quantity: 1,
            costUnit: 25, saleUnit: 40, costTotal: 25, saleTotal: 40 },
        ],
        totalCost: 4900, finalSale: 5200, profitAmount: 300,
        profitPerCbm: 10, profitPercentage: 6, meetsMinimumMargin: false,
      }),
    },
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
    isOwnLclMatrixContext: () => own,
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
    sectionForDetail: (type: string) => type === 'Freight' ? 'international_freight'
      : type === 'OriginCharge' ? 'origin_charges' : 'destination_charges',
    costContextLabel: () => '',
    defaultChargeBasis: () => 'PerShipment',
    displayValue: (currency: any) => currency.value ?? currency.name ?? '',
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

test('own LCL screen 7 recalculates every matrix item, preserves detail IDs, and retains manual charges', async () => {
  const { env, events, runRefresh } = refreshHarness([], true)
  const id = '11111111-1111-4111-8111-111111111111'
  const marker = 'LCL PROPIO · ConsolidadoId: ' + id
  env.rateLines.value = [{
    key: 'existing:F', detailId: 'F', costId: null, name: 'Flete internacional',
    notes: marker, costDetailType: 'Freight', costType: 'Fixed',
    chargeBasis: 'PerChargeableCbm', section: 'international_freight',
    costAmount: 164.81, saleAmount: 171.8, included: true, optional: false, manual: false,
  }, {
    key: 'existing:Z', detailId: 'Z', costId: null, name: 'Zone Charge',
    notes: marker, costDetailType: 'DestinationCharge', costType: 'Fixed',
    chargeBasis: 'PerShipment', section: 'destination_charges',
    costAmount: 0, saleAmount: 50, included: true, optional: false, manual: false,
  }, {
    key: 'existing:M', detailId: 'M', name: 'Recargo manual',
    notes: null, costDetailType: 'DestinationCharge', costType: 'Variable',
    chargeBasis: 'PerShipment', section: 'destination_charges',
    costAmount: 12, saleAmount: 20, included: true, optional: false, manual: true,
  }]
  env.lclSelectedSource.value = { kind: 'Own', id, requestedCbm: 29, currencyId: 'USD',
    currencyName: 'USD', currencyCode: 'USD', lines: [] }
  env.loadApplicableCosts = async () => { throw new Error('Do not load global costs for own LCL') }

  await runRefresh()

  assert.deepEqual(Array.from(env.rateLines.value, (item: any) => item.name), [
    'Flete internacional', 'Zone Charge', 'DMCE', 'Manejos', 'Recargo manual',
  ])
  assert.equal(env.rateLines.value[0].detailId, 'F')
  assert.equal(env.rateLines.value[0].costAmount, 165)
  assert.equal(env.rateLines.value[1].detailId, 'Z')
  assert.equal(env.rateLines.value[2].costAmount, 65)
  assert.equal(env.rateLines.value[4].detailId, 'M')
  assert.equal(env.rateLines.value[4].saleAmount, 20)
  assert.equal(env.lclSelectedSource.value.lines.length, 4)
  assert.equal(env.screen7OwnLclRefreshContext.value, 'normal-context')
  assert.equal(env.screen7RefreshPromptOpen.value, false)
  assert.deepEqual(events, ['saved', 'success'])
})
