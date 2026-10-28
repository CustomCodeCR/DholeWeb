import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingFtlEditPreservationFinal } from '../build/pricingFtlEditPreservationFinal.ts'

const fixture = [
  '<script setup lang="ts">',
  'const eligibleAgents = computed(() => catalogs.agents.filter(agentMatchesSelectedPol))',
  "const one = persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD'",
  "const two = persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD'",
  'async function next() {',
  '  if (step.value === 6 && props.modificationRequestId && pricingModificationApplied.value) {}',
  '}',
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
  assert.match(output, /agent\.id === persistedFtlAgentForEdit\.value\?\.id/)
  assert.equal(output.split('displayValue(findById(catalogs.currencies, persistedFtlFreightForEdit.currencyId))').length - 1, 2)
  assert.doesNotMatch(output, /selectedCurrency\?\.code \|\| 'USD'/)
})

test('FTL edit navigation does not rebuild original lines', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  assert.match(output, /shipmentModeForApi\.value === 'Ftl'\) \{\n    \/\/ Apply an explicitly edited freight amount/)
  assert.match(output, /syncPersistedFreightLineForEdit\(\)\n    step\.value = 7\n    return/)
  assert.match(output, /editingRate\.value && !props\.viewOnly && shipmentModeForApi\.value !== 'Ftl'/)
  assert.match(output, /relinkExistingDetailIdsForEdit\(\)/)
})

test('saved FTL refresh adds only missing costs, and never replaces existing prices', () => {
  const output = patchPricingFtlEditPreservationFinal(fixture)
  const addOnly = output.split('async function applyScreen7DatabaseCosts() {')[1].split('  if (screen7RefreshBusy.value || props.viewOnly) return')[0]
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
