import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isPanamaOverweightSupplement } from '../src/modules/pricing/utils/panamaMultimodalOverweight.ts'

const source = readFileSync(
  new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8',
)

function extract(start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.ok(from >= 0 && to > from, 'Expected haulage runtime block: ' + start)
  return source.slice(from, to)
}

const classifierSource = extract(
  'function dholeHaulageOptionalAssociation(cost: {',
  '\nfunction dholeHaulageOtherConditionsMatch(',
)
const costsForSource = extract(
  'function dholeHaulageCostsFor(mode: DholeHaulageChoice)',
  '\nconst dholeMerchantCosts =',
)
const syncSource = extract(
  'const syncBlock = `function syncHaulageOptionalLines() {',
  '`\n  code = code.slice(0, syncStart)',
).replace('const syncBlock = `', '')

function compile(code: string) {
  return ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
}

const merchant = {
  id: 'merchant-balboa-san-jose',
  name: 'Transporte terrestre Balboa a San José',
  costType: 'Fixed',
  costDetailType: 'InlandTransport',
  operationalConditions: [],
  carrierId: null,
  carriers: [],
  chargeBasis: 'PerContainer',
}
const carrier = {
  ...merchant,
  id: 'carrier-balboa-san-jose',
  name: 'Inland Balboa Naviera',
  carrierId: 'CARRIER_1',
  carriers: [{ id: 'CARRIER_1' }],
}

function environment() {
  const state = {
    isPanamaOverweightSupplement,
    normalizeCatalogValue: (text: unknown) => String(text ?? '').toLowerCase(),
    dholeHaulageContextCosts: { value: [merchant, carrier] },
    dholeHaulageOtherConditionsMatch: () => true,
    dholeHaulageMatchesSelectedTerminal: () => true,
    isMultimodalViaPanama: () => true,
    selectedDestination: { value: { name: 'Multimodal vía Panamá' } },
    props: { viewOnly: false, rateId: null },
    form: { merchantHaulage: true, carrierHaulage: false },
    costs: { value: [merchant, carrier] },
    rateLines: { value: [
      { costId: merchant.id, name: merchant.name, costType: 'Fixed', optional: false, included: true },
      { costId: carrier.id, name: carrier.name, costType: 'Fixed', optional: false, included: true },
      { costId: 'shared', name: 'Cargos en destino Línea Naviera', costType: 'Fixed', optional: false, included: true },
    ] },
    dholeEnsureSelectedHaulageLines: () => {},
    shouldIncludeOptionalCost: () => false,
  }

  const classify = vm.runInNewContext(
    compile(classifierSource) + '\ndholeHaulageOptionalAssociation',
    state,
  ) as (cost: Record<string, unknown>) => string | null

  const costsFor = vm.runInNewContext(
    compile(costsForSource) + '\ndholeHaulageCostsFor',
    { ...state, dholeHaulageOptionalAssociation: classify },
  ) as (mode: 'merchant' | 'carrier') => Array<{ id: string }>

  const sync = vm.runInNewContext(
    compile(syncSource) + '\nsyncHaulageOptionalLines',
    {
      ...state,
      dholeHaulageOptionalAssociation: classify,
      dholeHaulageCostsFor: costsFor,
    },
  ) as () => void

  return { state, classify, costsFor, sync }
}

test('Fixed merchant inland with POE Balboa and POD San José is recognized as merchant', () => {
  const { classify, costsFor } = environment()
  assert.equal(classify(merchant), 'merchant')
  assert.equal(costsFor('merchant').map((cost) => cost.id).join(), merchant.id)
})

test('Fixed carrier inland remains a separate alternative, not a merchant charge', () => {
  const { classify, costsFor } = environment()
  assert.equal(classify(carrier), 'carrier')
  assert.equal(costsFor('carrier').map((cost) => cost.id).join(), carrier.id)
})

test('Fixed common destination charges and unrelated Gate fees are never haulage', () => {
  const { classify } = environment()
  assert.equal(classify({
    ...carrier, name: 'Cargos en destino Línea Naviera',
    costDetailType: 'DestinationCharge',
  }), null)
  assert.equal(classify({
    ...merchant, name: 'Gate', costDetailType: 'DestinationCharge',
  }), null)
})

test('Optional operational flag overrides provider inference; ambiguous flags are rejected', () => {
  const { classify } = environment()
  assert.equal(classify({ ...carrier, costType: 'Optional', operationalConditions: ['MerchantHaulage'] }), 'merchant')
  assert.equal(classify({
    ...merchant, costType: 'Optional',
    operationalConditions: ['MerchantHaulage', 'CarrierHaulage'],
  }), null)
})

test('Only costs from the validated selected route can activate a haulage choice', () => {
  const { state, costsFor } = environment()
  state.dholeHaulageContextCosts.value = []
  assert.equal(costsFor('merchant').length, 0)
  assert.equal(costsFor('carrier').length, 0)
})

test('Switching alternatives excludes opposite Fixed inland while retaining shared Fixed charges', () => {
  const { state, sync } = environment()
  sync()
  assert.equal(state.rateLines.value[0]?.included, true)
  assert.equal(state.rateLines.value[1]?.included, false)
  assert.equal(state.rateLines.value[2]?.included, true)
  state.form.merchantHaulage = false
  state.form.carrierHaulage = true
  sync()
  assert.equal(state.rateLines.value[0]?.included, false)
  assert.equal(state.rateLines.value[1]?.included, true)
  assert.equal(state.rateLines.value[2]?.included, true)
})

test('Estimates exclude fixed inland from shared costs to prevent double counting', () => {
  assert.match(source, /&& dholeHaulageOptionalAssociation\(cost\) === null/)
  assert.match(source, /optional: cost\.costType === 'Optional'/)
  assert.match(source, /label\.includes\('transporte terrestre'\)/)
})

test('saved Panama excess is independent of Merchant/Carrier selection', () => {
  const { state, classify, sync } = environment()
  const excess = { costId: 'excess', name: 'Flete Terrestre Internacional Panamá a Costa Rica',
    notes: 'Sobrepeso sobre 19.000 kg por contenedor; costo maestro calculado únicamente por 2000 kg excedentes.',
    costType: 'Optional', costDetailType: 'DestinationCharge', optional: true, included: true,
    costAmount: 400, saleAmount: 560, applyDestinationTax: true }
  state.rateLines.value.push(excess)
  assert.equal(classify(excess), null)
  sync()
  state.form.merchantHaulage = false
  state.form.carrierHaulage = true
  sync()
  assert.equal(excess.included, true)
  assert.equal(excess.costAmount, 400)
  assert.equal(excess.saleAmount, 560)
  assert.equal(excess.applyDestinationTax, true)
})
