import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const pluginSource = readFileSync(
  new URL('../build/pricingWizardOwnLclLinePersistence.ts', import.meta.url), 'utf8',
)
const startTag = 'const OWN_LCL_AGENCY_COST_HELPERS = String.raw' + String.fromCharCode(96) + '\n'
const start = pluginSource.indexOf(startTag)
assert.ok(start >= 0, 'the own LCL custom service bridge must be present')
const end = pluginSource.indexOf('\n' + String.fromCharCode(96), start + startTag.length)
assert.ok(end > start, 'own LCL custom service bridge must be complete')
const code = pluginSource.slice(start + startTag.length, end)
const compiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

const crc = { id: 'CRC', code: 'CRC', value: 'CRC' }
const usd = { id: 'USD', code: 'USD', value: 'USD' }
const target = {
  id: 'agency-cost',
  name: 'Servicio de agencia',
  costType: 'Fixed',
  costDetailType: 'DestinationCharge',
  shipmentMode: 'Lcl',
  shipmentModes: ['Lcl'],
  isActive: true,
  agentId: null,
  carrierId: null,
  polId: null, poeId: null, podId: null, portId: null,
  pols: [], poes: [], pods: [], agents: [], carriers: [], incoterms: [],
  services: [{ id: 'AGENCIA-CRC' }],
  currencyId: 'CRC', currencyName: 'CRC', currencyCode: 'CRC',
  chargeBasis: 'PerShipment',
  pricingRulesJson: JSON.stringify([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500,
      calculationMode: 'Flat', costAmount: 40000, saleAmount: 40000 },
    { dimension: 'WeightKg', minValue: 501, maxValue: null,
      calculationMode: 'Flat', costAmount: 60000, saleAmount: 60000 },
  ]),
}
function fixture() {
  const freight = { key: 'own-matrix-freight', section: 'international_freight',
    costDetailType: 'Freight', costAmount: 100, saleAmount: 120, name: 'Flete internacional' }
  const originCustoms = { key: 'own-matrix-customs', section: 'origin_charges',
    costDetailType: 'CustomsCharge', name: 'CUSTOMS', costAmount: 25, saleAmount: 25 }
  const env: Record<string, any> = {
    props: { viewOnly: false },
    shipmentModeForApi: { value: 'Lcl' },
    isOwnLclMatrixContext: () => true,
    crcImportContext: { value: true },
    selectedCrcCustomsService: { value: { id: 'AGENCIA-CRC' } },
    visibleSections: { value: ['international_freight', 'origin_charges', 'destination_charges'] },
    lclSelectedSource: { value: { kind: 'Own' } },
    allCosts: { value: [target] }, costs: { value: [] },
    costContextPoeId: () => 'BALBOA',
    costContextAgentId: () => '',
    costSpecificity: () => 0,
    selectedCurrency: { value: usd },
    selectedEquipment: { value: null },
    catalogs: { currencies: [usd, crc] },
    crcCurrency: { value: crc },
    findById: (items: any[], id: string) => items.find((x) => x.id === id),
    displayValue: (item: { value: string }) => item?.value,
    normalizeCatalogValue: (v: string) => String(v ?? '').toLowerCase(),
    costContextLabel: () => 'Agencia aduanal Costa Rica',
    isCrcCustomsLine: (line: { section: string; costDetailType: string; name: string; serviceIds?: string[] },
      serviceId: string) => line.section === 'destination_charges'
      && (line.serviceIds?.includes(serviceId) ||
        /aduan|agencia/i.test(line.name)),
    form: {
      cargoWeightKg: 500, cargoPackages: 1, storageDays: 0,
      incotermId: 'FCA', originId: 'SHANGHAI', destinationId: 'BALBOA', podId: 'SAN_JOSE',
    },
    rateLines: { value: [freight, originCustoms] },
    resolveCostPricing: (cost: typeof target, cargo: { weightKg: number | null }) => {
      const weight = cargo.weightKg
      if (!weight) return null
      const rules = JSON.parse(cost.pricingRulesJson)
      return rules.find((rule: any) => weight >= rule.minValue
        && (rule.maxValue == null || weight <= rule.maxValue)) ?? null
    },
    ensureCrcCustomsLine: () => { throw Error('configured Cost should not use fallback') },
    number: (v: unknown) => Number(v) || 0,
  }
  const methods = vm.runInNewContext(compiled + '\n({ sync: syncOwnLclCrcAgencyLine })', env)
    as { sync: (force?: boolean) => void }
  return { env, ...methods }
}

test('own LCL loads configured CRC agency as an independent line at 500 kg', () => {
  const { env, sync } = fixture()
  sync()
  assert.equal(env.rateLines.value.length, 3)
  const agency = env.rateLines.value[2]
  assert.equal(agency.name, 'Servicio de agencia')
  assert.equal(agency.costId, null,
    'Own-LCL selected agency must survive server fixed-cost synchronization')
  assert.match(agency.notes, /Costo maestro Pricing: agency-cost/)
  assert.match(agency.notes, /Servicio aduanal CRC seleccionado/)
  assert.equal(agency.costAmount, 40000)
  assert.equal(agency.saleAmount, 40000)
  assert.equal(agency.currencyCode, 'CRC')
  assert.equal(agency.chargeBasis, 'PerShipment')
  assert.equal(env.rateLines.value[1].name, 'CUSTOMS')
  sync()
  assert.equal(env.rateLines.value.length, 3, 'watchers must not duplicate the agency charge')
  const masterRefs = String(env.rateLines.value[2].notes).match(/Costo maestro Pricing:/g) ?? []
  assert.equal(masterRefs.length, 1, 'watchers must not multiply cost provenance markers')
})

test('own LCL selects the next configured tier starting at 501 kg', () => {
  const { env, sync } = fixture()
  env.form.cargoWeightKg = 501
  sync()
  assert.equal(env.rateLines.value[2].costAmount, 60000)
  assert.equal(env.rateLines.value[2].saleAmount, 60000)
})

test('own LCL preserves saved edits unless explicit refresh was requested', () => {
  const { env, sync } = fixture()
  env.form.cargoWeightKg = 499
  env.rateLines.value.push({
    key: 'existing:SAVED', detailId: 'SAVED', costId: null,
    name: 'Servicio de agencia', section: 'destination_charges',
    costDetailType: 'DestinationCharge', currencyId: 'CRC',
    currencyName: 'CRC', currencyCode: 'CRC',
    costAmount: 38000, saleAmount: 50000, included: true,
  })
  sync()
  assert.equal(env.rateLines.value.length, 3)
  assert.equal(env.rateLines.value[2].saleAmount, 50000)
  sync(true)
  assert.equal(env.rateLines.value[2].saleAmount, 40000)
  assert.equal(env.rateLines.value[2].detailId, 'SAVED')
})

test('cost association and destination must match before including own LCL agency', () => {
  const { env, sync } = fixture()
  env.allCosts.value = [{ ...target, services: [{ id: 'OTHER' }] }]
  env.ensureCrcCustomsLine = (lines: any[]) => { lines.push({ key: 'service:customs-cr', saleAmount: 0 }) }
  sync()
  assert.equal(env.rateLines.value[2].key, 'service:customs-cr',
    'missing matching cost should expose the unpriced service')
  const second = fixture()
  second.env.crcImportContext.value = false
  second.sync()
  assert.equal(second.env.rateLines.value.length, 2)
  const third = fixture()
  third.env.selectedCrcCustomsService.value = null
  third.sync()
  assert.equal(third.env.rateLines.value.length, 2)
})
