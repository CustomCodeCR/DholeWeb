import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
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

function refreshHarness(pricingCosts: Array<Record<string, unknown>>, own = false, allActiveCosts = pricingCosts) {
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
    form: { agentId: 'WWL', carrierId: 'MSC', freightCost: 0, freightSale: 0, miamiCommercialPlan: null, cargoValue: 0,
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
    lclChargeableCbm: { value: 29 },
    isMiamiLcl: { value: false },
    lclCargoLines: { value: [{ description: 'Carga LCL', units: 1, totalWeightKg: 0,
      lengthCm: 100, widthCm: 100, heightCm: 2900 }] },
    screen7OwnLclRefreshContext: { value: '' },
    persistedOwnLclConsolidationId: () => '11111111-1111-4111-8111-111111111111',
    OwnLclConsolidationService: {
      get: async () => { throw new Error('Do not call consolidation detail GET in screen 7') },
      calculate: async (_id: string, request: any) => {
        events.push('matrix:' + request.destinationCode + ':' + request.polCode
          + ':' + request.cargoLines[0]?.heightCm)
        return ({
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
      }) },
    },
    explicitlyRemovedPersistedDetailIds: { value: new Set<string>() },
    costContextAgentId: () => env.form.agentId,
    shipmentModeForApi: { value: 'Fcl' },
    fclAllCarrierIds: { value: ['MSC'] },
    fclContainerAllocations: { value: [] },
    reconcileFclFreightLines: () => {
      const allocations = env.fclContainerAllocations.value
      const all = env.rateLines.value
      const used = new Set<number>()
      const reconciled = allocations.map((allocation: any) => {
        const index = all.findIndex((line: any, idx: number) =>
          !used.has(idx) && line.costDetailType === 'Freight'
          && (String(line.name).includes(allocation.containerTypeName)
            || String(line.notes ?? '').includes(allocation.containerTypeName)))
        const chosen = index >= 0 ? all[index] : all.find((line: any) => line.costDetailType === 'Freight')
        if (index >= 0) used.add(index)
        return { ...chosen, key: 'freight:' + allocation.containerTypeId,
          name: 'Flete Internacional · ' + allocation.containerTypeName,
          costDetailType: 'Freight', section: 'international_freight',
          costAmount: allocation.freightCostAmount,
          saleAmount: allocation.freightSaleAmount, included: true }
      })
      env.rateLines.value = [
        ...all.filter((line: any) => line.costDetailType !== 'Freight'),
        ...reconciled,
      ]
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
      selectCosts: async () => allActiveCosts,
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


test('screen 7 replaces RS/ONE historical charges with WWL/MSC and marks obsolete details for deletion', async () => {
  const current = [
    { id: 'C1', name: 'Cargo en destino', costDetailType: 'DestinationCharge',
      costType: 'Fixed', isActive: true, currencyId: 'USD', currencyCode: 'USD',
      currencyName: 'USD', costAmount: 135, saleAmount: 175 },
    { id: 'C-WWL', name: 'Manejos', costDetailType: 'DestinationCharge',
      costType: 'Fixed', isActive: true, agentId: 'WWL',
      currencyId: 'USD', currencyCode: 'USD', currencyName: 'USD',
      costAmount: 50, saleAmount: 65 },
    { id: 'C-MSC', name: 'Release', costDetailType: 'DestinationCharge',
      costType: 'Fixed', isActive: true, carrierId: 'MSC',
      currencyId: 'USD', currencyCode: 'USD', currencyName: 'USD',
      costAmount: 75, saleAmount: 95 },
  ]
  const old = [
    { ...current[1], id: 'C-RS', agentId: 'RS', costAmount: 40 },
    { ...current[2], id: 'C-ONE', carrierId: 'ONE', costAmount: 70 },
  ]
  const { env, runRefresh } = refreshHarness(current, false, [...current, ...old])
  env.rateLines.value.push(
    { key: 'existing:RS', detailId: 'RS', costId: 'C-RS', name: 'Manejos',
      costDetailType: 'DestinationCharge', costType: 'Fixed',
      section: 'destination_charges', costAmount: 40, saleAmount: 65,
      included: true, optional: false, manual: false },
    { key: 'existing:ONE', detailId: 'ONE', costId: 'C-ONE', name: 'Release',
      costDetailType: 'DestinationCharge', costType: 'Fixed',
      section: 'destination_charges', costAmount: 70, saleAmount: 95,
      included: true, optional: false, manual: false },
  )
  await runRefresh()
  assert.deepEqual(
    Array.from(env.rateLines.value, (line: any) => line.costId).filter(Boolean).sort(),
    ['C-MSC', 'C-WWL', 'C1'].sort(),
  )
  assert.deepEqual(
    Array.from(env.explicitlyRemovedPersistedDetailIds.value).sort(),
    ['ONE', 'RS'],
  )
})

test('multi-agent configured cost remains valid when the selected agent is not its legacy first agent', async () => {
  const current = [{
    id: 'C-SHARED', name: 'ISPS', costDetailType: 'DestinationCharge',
    costType: 'Fixed', isActive: true, agentId: 'RS',
    agents: [{ id: 'RS' }, { id: 'WWL' }],
    currencyId: 'USD', currencyCode: 'USD', currencyName: 'USD',
    costAmount: 15, saleAmount: 20,
  }]
  const { env, runRefresh } = refreshHarness(current)
  await runRefresh()
  assert.ok(env.rateLines.value.some((line: any) => line.costId === 'C-SHARED'))
})

test('multi-FCL refresh also retains charges from an additional selected carrier', async () => {
  const current = [{
    id: 'C-ONE', name: 'Inland ONE', costDetailType: 'InlandTransport',
    costType: 'Fixed', isActive: true, carrierId: 'ONE',
    currencyId: 'USD', currencyCode: 'USD', currencyName: 'USD',
    costAmount: 40, saleAmount: 50,
  }]
  const { env, runRefresh } = refreshHarness(current)
  env.fclAllCarrierIds.value = ['MSC', 'ONE']
  await runRefresh()
  assert.ok(env.rateLines.value.some((line: any) => line.costId === 'C-ONE'))
})

test('FCL refresh reconciles generic plus persisted container freight into exactly one freight', async () => {
  const { env, runRefresh } = refreshHarness([])
  env.form.freightCost = 6700
  env.form.freightSale = 6950
  env.editingRate.value = {
    containers: [{ containerTypeId: '40HC', containerTypeName: '40HC', quantity: 1 }],
  }
  env.fclContainerAllocations.value = [{
    containerTypeId: '40HC', containerTypeName: '40HC', quantity: 1,
    freightCostAmount: 6700, freightSaleAmount: 6950,
  }]
  env.rateLines.value = [
    { key: 'existing:freight', detailId: 'F-40HC', costId: null,
      name: 'Flete Internacional · 40HC', notes: 'Flete específico para 1 × 40HC',
      costDetailType: 'Freight', costType: 'Variable', section: 'international_freight',
      costAmount: 6700, saleAmount: 6950, included: true, manual: false },
    { key: 'existing:duplicate', detailId: 'F-OLD', costId: null,
      name: 'Flete Internacional', notes: 'Fuente anterior',
      costDetailType: 'Freight', costType: 'Variable', section: 'international_freight',
      costAmount: 6700, saleAmount: 6950, included: true, manual: false },
  ]
  env.rebuildRateLines = () => {
    env.rateLines.value = [{
      key: 'freight', name: 'Flete Internacional',
      costDetailType: 'Freight', costType: 'Variable',
      section: 'international_freight', costAmount: 6700, saleAmount: 6950,
      included: true, manual: false,
    }]
  }
  await runRefresh()
  const freight = env.rateLines.value.filter((line: any) => line.costDetailType === 'Freight')
  assert.equal(freight.length, 1)
  assert.equal(freight[0].detailId, 'F-40HC')
  assert.equal(freight[0].name, 'Flete Internacional · 40HC')
  assert.ok(env.explicitlyRemovedPersistedDetailIds.value.has('F-OLD'))
  assert.ok(!env.explicitlyRemovedPersistedDetailIds.value.has('F-40HC'))
})

test('FCL refresh retains one freight per two different equipment types', async () => {
  const { env, runRefresh } = refreshHarness([])
  env.fclContainerAllocations.value = [
    { containerTypeId: '40HC', containerTypeName: '40HC', quantity: 1,
      freightCostAmount: 6700, freightSaleAmount: 6950 },
    { containerTypeId: '20DV', containerTypeName: '20DV', quantity: 1,
      freightCostAmount: 3400, freightSaleAmount: 3650 },
  ]
  env.rateLines.value = [
    { key: 'existing:1', detailId: 'F-40HC', name: 'Flete Internacional · 40HC',
      costDetailType: 'Freight', section: 'international_freight', included: true },
    { key: 'existing:2', detailId: 'F-20DV', name: 'Flete Internacional · 20DV',
      costDetailType: 'Freight', section: 'international_freight', included: true },
  ]
  env.rebuildRateLines = () => {
    env.rateLines.value = [{ key: 'freight', name: 'Flete Internacional',
      costDetailType: 'Freight', section: 'international_freight', included: true }]
  }
  await runRefresh()
  const freight = env.rateLines.value.filter((line: any) => line.costDetailType === 'Freight')
  assert.equal(freight.length, 2)
  assert.deepEqual(Array.from(freight, (line: any) => line.detailId).sort(), ['F-20DV','F-40HC'])
  assert.equal(env.explicitlyRemovedPersistedDetailIds.value.size, 0)
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
  assert.deepEqual(events, ['matrix:CR:SHANGHAI:2900', 'saved', 'success'])
})

test('wizard includes own LCL service import used by screen 7 refresh', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.ok(wizard.includes("import { OwnLclConsolidationService } from '@/core/services/ownLclConsolidationService'"), 'wizard must import the own LCL calculation service')
})
