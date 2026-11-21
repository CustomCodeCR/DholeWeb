import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const loader = read('../build/pricingFtlLandCostsFix.ts')
const optional = read('../build/pricingOptionalChargesFinalGuard.ts')
const edit = read('../build/pricingWizardStep4NavigationHardFix.ts')
const wizard = read('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

function costPredicate() {
  const begin = loader.indexOf('function catalogCostMatchesCurrentContext(cost: CostSelectDto) {')
  const end = loader.indexOf('function maritimeFclCostMatchesCurrentContext(', begin)
  assert.ok(begin >= 0 && end > begin, 'multi-modal fallback must be available')
  const source = ts.transpileModule(loader.slice(begin, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const state = {
    form: {
      originId: 'POL1', destinationId: 'POE1', podId: 'POD1',
      carrierId: 'NAV1', agentId: 'AGE1', incotermId: 'FOB',
      serviceIds: ['CUSTOMS', 'DOC'],
    },
    selectedMode: 'Fcl',
    costShipmentModeForApi: () => state.selectedMode,
    costContextPoeId: () => state.form.destinationId,
    costContextAgentId: () => state.form.agentId,
    maritimeFclRelationMatches: (relations: Array<{ id: string }> | null, legacy: string | null, selected: string) => {
      const ids = Array.isArray(relations) ? relations.map(x => x.id).filter(Boolean) : []
      return ids.length ? Boolean(selected) && ids.includes(selected) : !legacy || legacy === selected
    },
  }
  const match = vm.runInNewContext(source + '\ncatalogCostMatchesCurrentContext', state) as
    (cost: Record<string, unknown>) => boolean
  return { match, state }
}

const customs = {
  id: 'COST1', name: 'Agencia Aduanal', costType: 'Fixed',
  costDetailType: 'CustomsCharge', isActive: true,
  shipmentModes: ['Fcl'], incoterms: [{ id: 'CIF' }],
  services: [{ id: 'CUSTOMS' }], pols: [{ id: 'POL1' }],
  poes: [{ id: 'OLD-POE' }, { id: 'POE1' }],
  poeId: 'OLD-POE',
  pods: [{ id: 'POD1' }], carriers: [{ id: 'NAV1' }],
  agents: [{ id: 'AGE1' }], portId: 'OLD-POE', portRole: 'Poe',
}

test('the same matched customs and surcharge catalogue charges work under all 11 Incoterms', () => {
  const { match, state } = costPredicate()
  for (const incoterm of ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']) {
    state.form.incotermId = incoterm
    assert.equal(match(customs), true, incoterm + ' must not suppress the cost')
  }
})

test('route, naviera, agent, mode and services still reject unrelated charges', () => {
  const { match, state } = costPredicate()
  assert.equal(match({ ...customs, isActive: false }), false)
  assert.equal(match({ ...customs, shipmentModes: ['Ltl'] }), false)
  assert.equal(match({ ...customs, services: [{ id: 'OTHER' }] }), false)
  assert.equal(match({ ...customs, agents: [{ id: 'AGE2' }] }), false)
  assert.equal(match({ ...customs, carriers: [{ id: 'NAV2' }] }), false)
  assert.equal(match({ ...customs, poes: [{ id: 'POE2' }] }), false)
  assert.equal(match({ ...customs, pods: [{ id: 'POD2' }] }), false)
  state.selectedMode = 'Ltl'
  assert.equal(match({ ...customs, shipmentModes: ['Any'] }), true)
  state.selectedMode = 'AirConsol'
  assert.equal(match({ ...customs, shipmentModes: ['Air'] }), true)
})

test('catalog fallback and CRM failure handling load charges without silently changing preferential sale authorization', () => {
  assert.match(loader, /PricingService\.selectWizardCosts\(contextualQuery\)/)
  assert.match(loader, /catalogCostMatchesCurrentContext\(cost\)/)
  assert.match(loader, /const fullCatalog = bundle\.catalog/)
  assert.match(loader, /const contextualCosts = bundle\.applicable/)
  assert.match(loader, /await loadCustomerPreferentialRates\(\)[\s\S]*?catch \{/)
  assert.match(wizard, /const customerPreferentialError = ref/)
  assert.match(wizard, /Tarifas preferenciales no disponibles/)
  assert.doesNotMatch(wizard, /if \(customerPreferentialError\.value && !props\.rateId\) return/)
})

test('incoterm-only optional exclusions and existing-quote deletion are disabled', () => {
  assert.doesNotMatch(optional, /cost\.incoterms\.some/)
  assert.match(optional, /mode === 'any'/)
  assert.match(edit, /const allowed = new Set\(sectionOrder\)/)
})
