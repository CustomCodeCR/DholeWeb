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


const agentResolverStart = source.indexOf('function validPricingAgentId(value: unknown)')
const agentResolverEnd = source.indexOf('function currentCostContextKey()', agentResolverStart)
assert.ok(agentResolverStart >= 0 && agentResolverEnd > agentResolverStart,
  'Pricing agent resolver must validate the GUID before sending a context query')

const agentResolverJs = ts.transpileModule(
  source.slice(agentResolverStart, agentResolverEnd),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText

function agentContext() {
  const env = {
    form: { agentId: '__dhole_lcl_gcf_agent__' },
    shipmentModeForApi: { value: 'Lcl' },
    lclSelectedSource: {
      value: {
        kind: 'Own', providerId: '__dhole_lcl_gcf_agent__',
        providerName: 'Grupo Castro Fallas', providerCode: 'GCF',
      },
    },
    catalogs: { agents: [] as Array<{ id: string; code: string; name: string }> },
    displayValue: (item: { name: string }) => item.name,
    normalizeCatalogValue: (value: string) => String(value ?? '').toLowerCase(),
  }
  const agentId = vm.runInNewContext(agentResolverJs + '\ncostContextAgentId', env)
    as () => string
  return { env, agentId }
}

test('LCL GCF UI-only agent ID is omitted from the GUID-based costs/select query', () => {
  const { agentId } = agentContext()
  assert.equal(agentId(), '')
  assert.equal(agentId() || undefined, undefined)
})

test('LCL GCF configured agent GUID is used when it exists in Config', () => {
  const { env, agentId } = agentContext()
  const realId = 'c536ce9d-6137-4c25-8e7c-9b6def9731b8'
  env.catalogs.agents.push({ id: realId, code: 'GCF', name: 'Grupo Castro Fallas' })
  assert.equal(agentId(), realId)
})

test('LCL source UUID or real selected agent UUID is retained without synthetic IDs', () => {
  const { env, agentId } = agentContext()
  const providerId = '97dbef84-2345-4ccc-95c4-601b1b377abf'
  env.lclSelectedSource.value.providerId = providerId
  assert.equal(agentId(), providerId)
  env.lclSelectedSource.value.providerId = 'provider-not-a-guid'
  env.form.agentId = 'c536ce9d-6137-4c25-8e7c-9b6def9731b8'
  assert.equal(agentId(), env.form.agentId)
  env.form.agentId = '__dhole_lcl_gcf_agent__'
  assert.equal(agentId(), '')
})
