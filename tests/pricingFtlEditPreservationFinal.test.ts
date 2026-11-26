import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingFtlEditPreservationFinal } from '../build/pricingFtlEditPreservationFinal.ts'

const fixture = [
  '<script setup lang="ts">',
  'const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))',
  'const eligibleAgents = computed(() => catalogs.agents.filter(agentMatchesSelectedPol))',
  "const one = persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD'",
  "const two = persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD'",
  'async function next() {',
  '  if (step.value === 6) {}',
  '}',
  'function previous() {}',
  'async function saveRate() {',
  '  if (editingRate.value && !props.viewOnly) {',
  '    await loadApplicableCosts()',
  '  }',
  '  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({}))',
  '}',
  'async function applyScreen7DatabaseCosts() {}',
  '</script>',
  'Actualizar desde la base de datos</DhButton>',
].join('\n')

test('preserves the saved agent and displays Config.Value instead of catalog code', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  assert.match(output, /persistedFtlAgentForEdit = computed/)
  assert.match(output, /rate\.agentId/)
  assert.match(output, /rate\.agentName/)
  assert.match(output, /agent\.id === historical\?\.id/)
  assert.equal(output.split('displayValue(findById(catalogs.currencies, persistedFtlFreightForEdit.currencyId))').length - 1, 2)
  assert.doesNotMatch(output, /selectedCurrency\?\.code \|\| 'USD'/)
})

test('FTL edit navigation does not rebuild original lines', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  assert.match(output, /!props\.viewOnly && shipmentModeForApi\.value === 'Ftl'\) \{/)
  assert.match(output, /syncPersistedFreightLineForEdit\(\)\n    step\.value = 7\n    return/)
  assert.match(output, /editingRate\.value && !props\.viewOnly && shipmentModeForApi\.value !== 'Ftl'/)
  assert.match(output, /relinkExistingDetailIdsForEdit\(\)/)
})

test('saved FTL refresh adds only missing costs, and never replaces existing prices', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  const addOnly = output.split('async function applyScreen7DatabaseCosts() {')[1]
  assert.match(addOnly, /rateLines\.value = \[\.\.\.previous, \.\.\.additions\]/)
  assert.match(addOnly, /existingCostIds\.has\(cost\.id\) \|\| originalCostIds\.has\(cost\.id\)/)
  assert.match(output, /Agregar solo cargos faltantes/)
  assert.doesNotMatch(addOnly, /rebuildRateLines\(\)/)
})

test('fails fast when a required Vite-transformed anchor changes', () => {
  assert.throws(() => patchPricingFtlEditPreservationFinal('<script></script>'), /persisted FTL agent options/)
  const result = patchPricingFtlEditPreservationFinal(fixture)
  assert.equal(patchPricingFtlEditPreservationFinal(result), result)
})


test('historical FTL agent is available in view/edit without crossing an origin change', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  const start = output.indexOf('const persistedFtlAgentForEdit = computed')
  const end = output.indexOf('watch([step, hydratingExistingRate', start)
  assert.ok(start >= 0 && end > start)
  const runtime = output.slice(start, end).replace('computed<CatalogItemSelectDto | null>', 'computed')
  const selected = output.split('\n').find(line => line.startsWith('const selectedAgent = computed'))
  assert.ok(selected)
  const form = { originId: 'HN', modality: 'Land', agentId: 'saved-gcf' }
  const rate = { id: 'quote', shipmentMode: 'Ftl', polId: 'HN', agentId: 'saved-gcf',
    agentName: 'Grupo Castro Fallas', agentCode: 'GCF' }
  const catalogs = { agents: [{ id: 'other', value: 'Other', code: 'OTHER' }] }
  const props = { rateId: 'quote', viewOnly: true }
  const computed = (get: () => unknown) => ({ get value() { return get() } })
  const findById = (items: { id: string }[], id: string) => items.find(item => item.id === id) ?? null
  const run = new Function('form','editingRate','catalogs','props','shipmentModeForApi','computed','findById','agentMatchesSelectedPol',
    runtime + '\n' + selected + '\nreturn { persistedFtlAgentForEdit, eligibleAgents, selectedAgent }')
  const result = run(form, { value: rate }, catalogs, props, { value: 'Ftl' }, computed, findById, () => false)
  assert.equal(result.selectedAgent.value.id, 'saved-gcf')
  assert.equal(result.selectedAgent.value.value, 'Grupo Castro Fallas')
  assert.equal(result.eligibleAgents.value.length, 1)
  props.viewOnly = false
  assert.equal(result.selectedAgent.value.code, 'GCF')
  form.originId = 'CR'
  assert.equal(result.selectedAgent.value, null)
  assert.equal(result.eligibleAgents.value.length, 0)
  form.originId = 'HN'
  form.agentId = 'other'
  assert.equal(result.selectedAgent.value.id, 'other')
  props.rateId = ''
  assert.equal(result.persistedFtlAgentForEdit.value, null)
})


test('FTL agent recovery composes with the preceding Land provider transform', () => {
  const transformedFixture = fixture.replace(
    'const selectedAgent = computed(() => findById(catalogs.agents, form.agentId))',
    "const selectedAgent = computed(() =>\n  findById(catalogs.agents, form.agentId)\n    ?? (form.modality === 'Land' ? landAgentPlaceholder : null),\n)",
  )
  const output = patchPricingFtlEditPreservationFinal(transformedFixture)
  const selected = output.split('\n').find(line => line.startsWith('const selectedAgent = computed'))
  assert.ok(selected)
  assert.ok(selected.indexOf('persistedFtlAgentForEdit.value') < selected.indexOf('landAgentPlaceholder'))
})
