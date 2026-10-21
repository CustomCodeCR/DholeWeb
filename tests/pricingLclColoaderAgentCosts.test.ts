import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { pricingLclColoaderAgentCosts20261009 } from '../build/pricingLclColoaderAgentCosts20261009.ts'

const wizardPath = '/project/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const fixture = [
  'async function loadApplicableCosts() {}',
  'function applicableConfiguredCosts() {}',
  'function rebuildRateLines() {}',
  'function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {}',
].join('\n')

function createHarness() {
  const plugin = pricingLclColoaderAgentCosts20261009()
  const transform = plugin.transform as unknown as
    (source: string, id: string) => { code: string }
  const code = transform(fixture, wizardPath).code
  const start = code.indexOf('// dhole-lcl-coloader-agent-costs-20261009')
  const end = code.indexOf('function applicableConfiguredCosts() {', start)
  assert.ok(start >= 0 && end > start, 'LCL Coloader patch is installed')
  const script = ts.transpileModule(code.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText

  const state = {
    form: {
      originId: 'COLON_CONTAINER', destinationId: 'CALDERA', podId: '',
      agentId: 'PIER17', carrierId: '', incotermId: 'EXW',
      serviceIds: [], modality: 'Maritime', freightCost: 80, freightSale: 89,
    },
    shipmentModeForApi: { value: 'Lcl' },
    lclSelectedSource: {
      value: {
        kind: 'Coloader',
        manual: false,
        lines: [{
          key: 'coloader:freight', name: 'Flete internacional', costDetailType: 'Freight',
          costAmount: 80, saleAmount: 89, included: true, manual: false,
        }],
      },
    },
    props: { viewOnly: false },
    catalogs: { currencies: [{ id: 'USD', code: 'USD', label: 'USD' }] },
    selectedCurrency: { value: { id: 'USD', code: 'USD', label: 'USD' } },
    rateLines: { value: [] as Record<string, unknown>[] },
    PricingService: { selectCosts: async (_query: { applicableToContext?: boolean }) => [] as Record<string, unknown>[] },
    toastStore: { backendError: (error: unknown) => { throw error } },
    costContextAgentId: () => state.form.agentId,
    costs: { value: [] as Record<string, unknown>[] },
    allCosts: { value: [] as Record<string, unknown>[] },
    number: (value: unknown) => Number(value) || 0,
    normalizeCatalogValue: (value: unknown) => String(value ?? '').toLowerCase(),
    displayValue: (value: { label: string }) => value.label,
    costContextLabel: () => 'Agente: Pier17',
    defaultChargeBasis: () => 'PerShipment',
    sectionForCost: (cost: { costDetailType: string }) =>
      cost.costDetailType === 'OriginCharge' ? 'origin_charges' : 'destination_charges',
    incotermResponsibilitySections: { value: ['origin_charges', 'destination_charges'] },
    airLclCostMatchesCurrentContext: (_cost: Record<string, unknown>) => false,
  }
  const methods = vm.runInNewContext(
    script + '\n({ match: dholeLclColoaderAgentCostMatches, rebuild: rebuildLclColoaderAgentLines, load: loadApplicableCosts })',
    state,
  ) as {
    match: (cost: Record<string, unknown>) => boolean
    rebuild: () => void
    load: () => Promise<void>
  }
  return { ...methods, state }
}

const origin = (id: string, name: string) => ({
  id, name, costType: 'Fixed', costDetailType: 'OriginCharge',
  chargeBasis: 'PerShipment', currencyId: 'USD', currencyName: 'USD',
  currencyCode: 'USD', costAmount: 3, saleAmount: 5,
  agentId: 'PIER17',
  agents: [{ id: 'PIER17' }],
  shipmentMode: 'Lcl', shipmentModes: ['Lcl'],
  polId: 'COLON_FREE_ZONE',
  pols: [{ id: 'COLON_CONTAINER' }, { id: 'COLON_FREE_ZONE' }],
  poes: [], pods: [], incoterms: [], services: [],
})

test('Pier17 fixed origin charges apply to the second selected POL, not only legacy polId', () => {
  const { match, state } = createHarness()
  const names = ['Agency Fee', 'AMS', 'BL', 'EFS', 'FAS']
  const costs = names.map((name, index) => origin(String(index + 1), name))
  assert.ok(costs.every(match), 'All five fixed costs must match Colon Container')
  state.form.originId = 'COLON_FREE_ZONE'
  assert.ok(costs.every(match), 'Legacy first POL still matches')
  state.form.originId = 'OTHER_POL'
  assert.ok(costs.every((cost) => !match(cost)), 'Unconfigured POL must be rejected')
})

test('multi-agent/port restrictions and coloader carrier isolation remain enforced', () => {
  const { match, state } = createHarness()
  const cost = origin('BL', 'BL')
  assert.equal(match({ ...cost, agentId: 'OTHER_AGENT',
    agents: [{ id: 'OTHER_AGENT' }, { id: 'PIER17' }] }), true)
  assert.equal(match({ ...cost, agentId: 'OTHER_AGENT',
    agents: [{ id: 'OTHER_AGENT' }] }), false)
  assert.equal(match({ ...cost, agentId: null, agents: [] }), false)
  assert.equal(match({ ...cost, carrierId: 'MAERSK' }), false)
  assert.equal(match({ ...cost, chargeBasis: 'PerContainer' }), false)
  assert.equal(match({ ...cost, podId: 'SAN_JOSE', pods: [{ id: 'SAN_JOSE' }] }), false)
  assert.equal(match({ ...cost, poeId: 'MOIN', poes: [{ id: 'MOIN' }] }), false)
  assert.equal(match({ ...cost, portId: 'COLON_FREE_ZONE', portRole: 'Pol' }), true,
    'Legacy PortId must not override multi-POL selections')
  assert.equal(match({ ...cost, pols: [], polId: 'COLON_FREE_ZONE' }), false,
    'Legacy single-POL costs remain restricted')
  state.incotermResponsibilitySections.value = ['destination_charges']
  assert.equal(match(cost), true,
    'An applicable Pier17 OriginCharge must not be removed by display-only Incoterm sections')
  assert.equal(match({ ...cost, incoterms: [{ id: 'DIFFERENT_TERM' }] }), false,
    'Explicit Incoterm restrictions on the cost must still be respected')
})

test('screen 7 includes fixed charges exactly once alongside destination charges', () => {
  const { rebuild, state } = createHarness()
  const five = ['Agency Fee', 'AMS', 'BL', 'EFS', 'FAS']
    .map((name, index) => origin(String(index + 1), name))
  const destination = ['Handling', 'HBL', 'Manejos'].map((name, index) => ({
    ...origin('destination-' + index, name),
    pols: [], polId: null, costDetailType: 'DestinationCharge',
    costAmount: index === 0 ? 50 : 0, saleAmount: index === 0 ? 0 : 50,
  }))
  state.costs.value = [...five, ...destination]
  rebuild()
  const names = state.rateLines.value.map((line) => String(line.name))
  for (const name of [...five.map((cost) => cost.name), ...destination.map((cost) => cost.name)]) {
    assert.equal(names.filter((item) => item === name).length, 1, name + ' appears once')
  }
  rebuild()
  assert.equal(state.rateLines.value.length, 9, 'Rebuilding must not duplicate 8 charges + freight')
})


test('LCL coloader loader supplements contextual response with missing Pier17 origin costs', async () => {
  const { load, rebuild, state } = createHarness()
  const names = ['Agency Fee', 'AMS', 'BL', 'EFS', 'FAS']
  const originCosts = names.map((name, index) => origin(String(index + 1), name))
  const destinationCosts = ['Handling', 'HBL', 'Manejos'].map((name, index) => ({
    ...origin('destination-' + index, name),
    pols: [], polId: null, costDetailType: 'DestinationCharge',
  }))
  const requests: Array<{ applicableToContext?: boolean }> = []
  state.PricingService.selectCosts = async (query) => {
    requests.push(query)
    return query.applicableToContext ? destinationCosts : [...originCosts, ...destinationCosts]
  }
  await load()
  rebuild()
  assert.equal(requests.length, 2, 'Both contextual and complete catalog are read')
  assert.equal(state.costs.value.length, 8, 'All eight costs are reconciled')
  assert.equal(state.rateLines.value.length, 9, 'Eight fixed charges + one freight line are displayed')
  for (const cost of originCosts) {
    assert.equal(state.rateLines.value.filter((line) => line.name === cost.name).length, 1, cost.name)
  }
})

test('incoterm responsibility uses normalized EXW/FCA/FOB value, not opaque config CODE', async () => {
  const wizard = await readFile(
    new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
    'utf8',
  )
  assert.match(wizard, /incotermRateSections\(selectedIncotermCode\.value, configured\)/)
})

test('real Pier17 contextual response: all 8 costs survive FOB-style display section filtering', async () => {
  const { load, rebuild, state } = createHarness()
  // Exact values from /api/pricing/costs/select on 2026-10-14.
  const pier17 = 'f52257f5-a5ed-4f00-87e8-688296e2289e'
  const colonContainer = '1147bec1-d3c1-5c03-9782-ce61eec633a9'
  const colonFreeZone = 'c2600000-0000-4000-8000-000000000010'
  state.form.agentId = pier17
  state.form.originId = colonContainer
  state.form.destinationId = 'dd567784-6acc-4663-8d1c-b6cc2ec96056'
  state.form.incotermId = 'cb540bc7-56c9-435d-a400-c4e07a8562e9'
  state.form.serviceIds = ['c2300000-0000-4000-8000-000000000001']
  // Simulates the restrictive Incoterm section list that used to silently
  // discard every OriginCharge even after Pricing returned it as applicable.
  state.incotermResponsibilitySections.value = ['international_freight', 'destination_charges']

  const originRows = [
    ['4d136754-86c4-4b3d-a5a9-852af8a7215e', 'Agency Fee', 3, 5],
    ['002992ba-2c75-47ee-8b8a-ea77072509a1', 'AMS', 25, 30],
    ['9f6ee3a9-b956-41d5-b7f7-243d17fdca20', 'BL', 45, 50],
    ['23176dbc-f11d-412e-b99d-0aa4fbb0aa7a', 'EFS', 10, 15],
    ['be028d6c-5927-42ab-bb39-0d1a4a800ae5', 'FAS', 30, 35],
  ] as const
  const destinationRows = [
    ['edc568a0-3cc1-44f8-9ad4-c7f2481d2fd1', 'Handling', 50, 0],
    ['7d6de231-8b59-489c-a69a-50159a3bffcf', 'HBL', 0, 50],
    ['e5b98707-6f1f-4772-b178-e440be0887fa', 'Manejos', 0, 55],
  ] as const
  const originCosts = originRows.map(([id, name, costAmount, saleAmount]) => ({
    ...origin(id, name), costAmount, saleAmount,
    agentId: pier17, agents: [{ id: pier17 }],
    polId: colonFreeZone,
    pols: [{ id: colonContainer }, { id: colonFreeZone }],
    incoterms: [], services: [],
  }))
  const destinationCosts = destinationRows.map(([id, name, costAmount, saleAmount]) => ({
    ...origin(id, name), costAmount, saleAmount,
    agentId: pier17, agents: [{ id: pier17 }],
    costDetailType: 'DestinationCharge',
    polId: null, pols: [], incoterms: [], services: [],
  }))
  state.PricingService.selectCosts = async () => [...originCosts, ...destinationCosts]

  await load()
  assert.equal(state.costs.value.length, 8, 'API costs must remain intact after eligibility checks')
  rebuild()
  assert.equal(state.rateLines.value.length, 9, '8 master costs plus international freight')
  for (const [id, name, costAmount, saleAmount] of [...originRows, ...destinationRows]) {
    const line = state.rateLines.value.filter((entry) => entry.costId === id)
    assert.equal(line.length, 1, name + ' should appear exactly once on Screen 7')
    assert.equal(line[0]?.name, name)
    assert.equal(line[0]?.costAmount, costAmount)
    assert.equal(line[0]?.saleAmount, saleAmount)
    assert.equal(line[0]?.included, true)
  }
  rebuild()
  assert.equal(state.rateLines.value.length, 9, 'Repeated rendering must not create duplicates')
})

test('AirConsol retains matching fixed, variable and optional charges after coloader rebuilds', () => {
  const { rebuild, state } = createHarness()
  state.form.modality = 'Air'
  const airCosts = [
    { ...origin('air-awb', 'AWB'), shipmentMode: 'AirConsol', shipmentModes: ['AirConsol'], agentId: null, agents: [] },
    { ...origin('air-man', 'Manejos aéreo'), shipmentMode: 'AirConsol', shipmentModes: ['AirConsol'], agentId: null, agents: [], costType: 'Variable' },
    { ...origin('air-pickup', 'Retiro AWB'), shipmentMode: 'AirConsol', shipmentModes: ['AirConsol'], agentId: null, agents: [], costType: 'Optional' },
  ]
  state.allCosts.value = [...airCosts, { ...origin('ocean-only', 'Cargo marítimo'), shipmentMode: 'Lcl' }]
  state.airLclCostMatchesCurrentContext = (cost: Record<string, unknown>) =>
    cost.shipmentMode === 'AirConsol'

  rebuild()
  const names = state.rateLines.value.map((line) => String(line.name))
  assert.equal(names.includes('Cargo marítimo'), false)
  for (const cost of airCosts) {
    assert.equal(names.filter((name) => name === cost.name).length, 1, cost.name)
  }
  assert.equal(state.rateLines.value.length, 4, 'The air freight source and all three Pricing charges remain')

  rebuild()
  assert.equal(state.rateLines.value.length, 4, 'Another LCL refresh must preserve all air charges exactly once')
})

test('air pricing guard never delegates to the destructive maritime coloader optional merger', async () => {
  const source = await readFile(
    new URL('../build/pricingAirLclCostFinalGuard.ts', import.meta.url), 'utf8',
  )
  assert.match(source, /if \(!isLclColoaderAgentCostContext\(\)\) mergeConfiguredOptionalCostsIntoRateLines\(true\)/)
  assert.match(source, /\['airconsol', 'air', 'any'\]/)
  assert.doesNotMatch(source, /\['airconsol', 'lcl', 'any'\]/)
})
