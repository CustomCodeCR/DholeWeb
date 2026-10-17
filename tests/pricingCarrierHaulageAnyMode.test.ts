import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
const begin = source.indexOf('function maritimeFclCostMatchesCurrentContext(cost: CostSelectDto) {')
const end = source.indexOf('async function loadApplicableCosts()', begin)
assert.ok(begin >= 0 && end > begin, 'maritime FCL cost matcher must exist')

const js = ts.transpileModule(source.slice(begin, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

function matcher() {
  const state = {
    form: {
      originId: 'SHANGHAI',
      destinationId: 'CALDERA',
      podId: 'SAN_JOSE',
      carrierId: 'COSCO',
      incotermId: 'FOB',
      serviceIds: [] as string[],
    },
    costContextPoeId: () => state.form.destinationId,
    costContextAgentId: () => 'RS',
    maritimeFclRelationMatches: (
      relations: Array<{ id: string }> | null | undefined,
      legacyId: string | null | undefined,
      selectedId: string | null | undefined,
    ) => {
      const selected = String(selectedId ?? '').trim()
      const ids = (relations ?? []).map((relation) => relation.id)
      if (ids.length) return Boolean(selected) && ids.includes(selected)
      return !legacyId || (Boolean(selected) && legacyId === selected)
    },
  }

  const matches = vm.runInNewContext(
    js + '\nmaritimeFclCostMatchesCurrentContext',
    state,
  ) as (cost: Record<string, unknown>) => boolean
  return { state, matches }
}

const carrierCost = {
  id: '2661f755-f7f6-44c8-927f-990f53eb2a33',
  name: 'Inland Caldera a GAM (Naviera)',
  costType: 'Optional',
  costDetailType: 'DestinationCharge',
  operationalConditions: ['CarrierHaulage'],
  shipmentMode: 'Any',
  shipmentModes: [],
  carrierId: 'COSCO',
  carriers: [{ id: 'COSCO' }],
  poeId: 'CALDERA',
  poes: [{ id: 'CALDERA' }],
  // Legacy POD stores only one of the real selected PODs.
  podId: 'HEREDIA',
  pods: [{ id: 'HEREDIA' }, { id: 'SAN_JOSE' }],
  pols: [],
  agents: [],
  incoterms: [],
  services: [],
  portId: null,
  isActive: true,
}

test('COSCO Caldera Carrier Haulage with shipmentMode Any is eligible for FCL', () => {
  const { matches } = matcher()
  assert.equal(matches(carrierCost), true)
  assert.equal(matches({ ...carrierCost, shipmentModes: ['Any'] }), true)
  assert.equal(matches({ ...carrierCost, shipmentMode: 'Fcl', shipmentModes: ['Fcl'] }), true)
})

test('shipment wildcard does not relax carrier, port or explicit mode restrictions', () => {
  const { matches, state } = matcher()
  assert.equal(matches({ ...carrierCost, shipmentMode: 'Ftl', shipmentModes: ['Ftl'] }), false)
  assert.equal(matches({ ...carrierCost, carriers: [{ id: 'MSC' }] }), false)
  assert.equal(matches({ ...carrierCost, poes: [{ id: 'MOIN' }] }), false)
  state.form.podId = 'LIMON'
  assert.equal(matches(carrierCost), false)
})

test('COSCO Merchant FCL remains eligible independently of Carrier', () => {
  const { matches } = matcher()
  assert.equal(matches({
    ...carrierCost,
    id: 'e54a7ce1-a7e3-47f5-8d40-c66c8b32cf1d',
    name: 'Inland Caldera a GAM (Merchant)',
    shipmentMode: 'Fcl',
    shipmentModes: ['Fcl'],
    operationalConditions: ['MerchantHaulage'],
  }), true)
})
