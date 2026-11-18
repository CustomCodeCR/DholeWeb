import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import { pricingWizardPersistedLclHydration } from '../build/pricingWizardPersistedLclHydration.ts'

const src = readFileSync('build/pricingWizardPersistedLclHydration.ts', 'utf8')
const persistence = readFileSync('build/pricingWizardOwnLclLinePersistence.ts', 'utf8')
const costs = readFileSync('build/pricingExwFcaVariableCosts.ts', 'utf8')
const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')

const fixture = `
import { PricingService } from '@/core/services/pricingService'
async function hydrateExistingRate() {}
    form.pickupAddress = rate.pickupAddress ?? ''
    hydratePersistedCargoDescription(rate.cargoLines?.[0]?.description)
    if (refreshingDuplicatedRate.value && rate.shipmentMode === 'Fcl') {
`
const injected = pricingWizardPersistedLclHydration().transform(
  fixture, '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
)
assert.ok(injected?.code, 'The real Vite plugin must inject its persisted hydration function')

function extractFunction(code, name) {
  const start = code.indexOf('async function ' + name + '(')
  assert.ok(start >= 0, name + ' not injected')
  const brace = code.indexOf('{', start)
  let depth = 0
  for (let index = brace; index < code.length; index++) {
    if (code[index] === '{') depth++
    if (code[index] === '}') depth--
    if (depth === 0) return code.slice(start, index + 1)
  }
  throw new Error('Unbalanced injected ' + name)
}

function quote() {
  const marker = 'LCL PROPIO · ConsolidadoId: 44444444-4444-4444-8444-444444444444'
  return {
    id: 'rate-01', shipmentMode: 'Lcl', incotermName: 'EXW',
    polName: 'Miami', agentName: 'Grupo Castro Fallas', rateCode: 'LCL',
    rateDetails: [
      { id: 'line-freight', name: 'Flete Miami → Costa Rica', costDetailType: 'Freight', costId: null, notes: marker },
      { id: 'line-pickup', name: 'Transporte de recolección en Miami', costDetailType: 'InlandTransport', costId: null,
        notes: 'Cargo manual agregado desde el wizard de Pricing.' },
    ],
    chargeableQuantity: 7.062, totalUtilityAmount: 70, totalCostAmount: 0,
    totalSaleAmount: 400, marginPercentage: 30, validFrom: '2026-11-01', validTo: '2026-11-30',
  }
}

async function hydrate(viewOnly) {
  const saved = quote()
  const rows = saved.rateDetails.map((item) => ({
    key: 'existing:' + item.id, detailId: item.id, name: item.name,
    costId: item.costId, costDetailType: item.costDetailType,
    section: item.costDetailType === 'InlandTransport' ? 'pickup_origin' : 'international_freight',
    included: true, manual: !item.costId, notes: item.notes,
    costAmount: 25, saleAmount: 75, currencyId: 'USD', currencyCode: 'USD', chargeBasis: 'PerShipment',
  }))
  const sandbox = {
    props: { viewOnly },
    rateLines: { value: rows },
    lclRequestedCbm: { value: 0 },
    lclSelectedSourceKey: { value: '' },
    lclSelectedSource: { value: null },
    form: { carrierId: '', freightCost: 0, freightSale: 0 },
    normalizeCatalogValue: (value) => String(value ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(),
    splitPersistedLclTerms: (value) => String(value ?? '').split('\\n').filter(Boolean),
    transitDaysFrom: () => 5,
    ownLclKeepQuotedLine: (line) => /LCL PROPIO|ConsolidadoId:|Cargo manual agregado/i.test(String(line.notes ?? '')),
  }
  const js = stripTypeScriptTypes(extractFunction(injected.code, 'hydratePersistedLclSource'), { mode: 'strip' })
  const fn = vm.runInNewContext('(' + js + ')', sandbox)
  await fn(saved)
  return sandbox
}

test('saved EXW pickup remains in a read-only own-LCL quotation and its totals', async () => {
  const state = await hydrate(true)
  assert.equal(state.rateLines.value.length, 2)
  assert.equal(state.rateLines.value[1].saleAmount, 75)
  assert.equal(state.rateLines.value[1].costAmount, 25)
  assert.equal(state.lclSelectedSource.value.lines.length, 1, 'manual pickup must not become a matrix row')
})

test('editing own LCL keeps manual pickup identity and amounts after reload', async () => {
  const state = await hydrate(false)
  assert.equal(state.rateLines.value.length, 2)
  const pickup = state.rateLines.value.find((line) => line.detailId === 'line-pickup')
  assert.ok(pickup, 'Manual pickup must survive own-LCL rehydration')
  assert.equal(pickup.manual, true, 'Do not reset manual flag during rehydration')
  assert.equal(pickup.saleAmount, 75)
  assert.equal(pickup.costId, null)
  assert.equal(state.lclSelectedSource.value.lines.length, 1)
})

test('manual and configured pickup survive source-aware save and fixed-price lookup', () => {
  assert.match(persistence, /cargo manual agregado desde el wizard de pricing/)
  assert.match(persistence, /const isPickup = line.section === 'pickup_origin'/)
  assert.ok(persistence.includes('ownLclKeepQuotedLine(line, ${detailsMapperAnchor})'))
  assert.match(costs, /costType: cost.costType/)
  assert.match(costs, /costType: 'Fixed'/)
  assert.ok(costs.includes("sectionForCost(cost) === 'pickup_origin'"))
  assert.match(wizard, /Recolecta EXW pendiente de cotizar/)
  assert.match(src, /kind === 'Own' && !props.viewOnly/)
})
