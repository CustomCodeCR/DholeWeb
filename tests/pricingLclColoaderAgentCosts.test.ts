import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
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
  const end = code.indexOf('async function loadApplicableCosts() {', start)
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
    costs: { value: [] as Record<string, unknown>[] },
    number: (value: unknown) => Number(value) || 0,
    normalizeCatalogValue: (value: unknown) => String(value ?? '').toLowerCase(),
    displayValue: (value: { label: string }) => value.label,
    costContextLabel: () => 'Agente: Pier17',
    defaultChargeBasis: () => 'PerShipment',
    sectionForCost: (cost: { costDetailType: string }) =>
      cost.costDetailType === 'OriginCharge' ? 'origin_charges' : 'destination_charges',
    incotermResponsibilitySections: { value: ['origin_charges', 'destination_charges'] },
    airLclCostMatchesCurrentContext: () => false,
  }
  const methods = vm.runInNewContext(
    script + '\n({ match: dholeLclColoaderAgentCostMatches, rebuild: rebuildLclColoaderAgentLines })',
    state,
  ) as {
    match: (cost: Record<string, unknown>) => boolean
    rebuild: () => void
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
  assert.equal(match(cost), false, 'FOB-style scope excludes origin costs')
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
