import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { pricingExwFcaVariableCosts } from '../build/pricingExwFcaVariableCosts'

const wizardPath = '/project/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const fixture = [
  'function ownLclTransientSupplementalLines() {',
  "  return rateLines.value.filter((line) => line.manual || line.key === 'cargo-insurance:auto')",
  '}',
  'function addManualCharge() {}',
  '  const sourceDetails = isOwnLclMatrixContext()',
  '    ? includedLines.value.filter((line) => !line.costId)',
  '    : includedLines.value',
  '  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({}))',
].join('\n')

function generatedCode() {
  const plugin = pricingExwFcaVariableCosts()
  assert.equal(typeof plugin.transform, 'function')
  const transform = plugin.transform as unknown as (source: string, id: string) => { code: string }
  const result = transform(fixture, wizardPath)
  return result.code
}

test('Own LCL keeps matching EXW/FCA variable CostIds without importing other global costs', () => {
  const code = generatedCode()
  assert.match(code, /ownLclTransientSupplementalLines/)
  assert.match(code, /line\.key\)\.startsWith\('exw-fca-variable-cost:'\)/)
  assert.match(code, /!line\.costId \|\| String\(line\.key \?\? ''\)\.startsWith\('exw-fca-variable-cost:'\)/)
  assert.match(code, /line\.costId === cost\.id/)
})

test('Own LCL preserves CRC agency costs and EXW/FCA charges together', () => {
  const currentSource = fixture.replace(
    "? includedLines.value.filter((line) => !line.costId)",
    "? includedLines.value.filter((line) => !line.costId || String(line.key ?? '').startsWith('own-lcl-customs:'))",
  )
  const plugin = pricingExwFcaVariableCosts()
  const transform = plugin.transform as unknown as (source: string, id: string) => { code: string }
  const code = transform(currentSource, wizardPath).code
  assert.match(code, /!line\.costId \|\| String\(line\.key \?\? ''\)\.startsWith\('own-lcl-customs:'\) \|\| String\(line\.key \?\? ''\)\.startsWith\('exw-fca-variable-cost:'\)/)
})

test('Variable catalog matching honors EXW/FCA, multi-party assignments, modality and conditions', () => {
  const code = generatedCode()
  const begin = code.indexOf('function dholeExwFcaMatch(')
  const end = code.indexOf('function dholeExwFcaApply()', begin)
  assert.ok(begin >= 0 && end > begin)
  const matcherSource = code.slice(begin, end)
  const javascript = ts.transpileModule(matcherSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = {
    form: {
      modality: 'Maritime',
      originId: 'POL1', destinationId: 'POE1', podId: 'POD1',
      agentId: 'WWL', carrierId: '', incotermId: 'EXW1',
      serviceIds: ['PICKUP'],
    },
    shipmentModeForApi: { value: 'Lcl' },
    selectedIncotermCode: { value: 'EXW' },
    lclSelectedSource: { value: { kind: 'Own' } },
    incotermResponsibilitySections: { value: ['origin_charges'] },
    operationalConditionsSatisfied: (cost: { operationalConditions?: string[] }) =>
      !cost.operationalConditions?.includes('Unselected'),
    sectionForCost: () => 'origin_charges',
  }
  const match = vm.runInNewContext(javascript + '\ndholeExwFcaMatch', context) as
    (cost: Record<string, unknown>) => boolean
  const generic = {
    id: 'COST1', costType: 'Variable', costDetailType: 'OriginCharge',
    costAmount: 0, saleAmount: 0, chargeBasis: 'PerShipment',
    incoterms: [{ id: 'EXW1' }], services: [{ id: 'PICKUP' }],
  }
  assert.equal(match(generic), true, 'Zero-value generic EXW cost applies to LCL')
  assert.equal(match({ ...generic, agents: [{ id: 'RS' }, { id: 'WWL' }], agentId: 'RS' }), true,
    'Any matching multi-assigned agent wins over a legacy first-agent field')
  assert.equal(match({ ...generic, agents: [{ id: 'RS' }], agentId: 'RS' }), false)
  assert.equal(match({ ...generic, operationalConditions: ['Unselected'] }), false)
  assert.equal(match({ ...generic, shipmentModes: ['Ftl'] }), false)
  for (const mode of ['Fcl', 'Lcl', 'Ftl', 'Ltl']) {
    context.shipmentModeForApi.value = mode
    assert.equal(match(generic), true, 'Wildcard variable cost should support ' + mode)
  }
  context.form.modality = 'Air'
  context.shipmentModeForApi.value = 'Lcl'
  assert.equal(match({ ...generic, shipmentModes: ['AirConsol'] }), true)
  context.form.modality = 'Maritime'
  assert.equal(match({ ...generic, shipmentModes: ['AirConsol'] }), false)
  context.form.incotermId = 'FCA1'
  context.selectedIncotermCode.value = 'FCA'
  assert.equal(match({ ...generic, incoterms: [{ id: 'FCA1' }] }), true)
  assert.equal(match(generic), false, 'EXW-only cost must not leak into FCA')
})
