import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync('src/modules/pricing/components/PricingRateExistingWizardStable.vue', 'utf8')
const acceptanceStart = wizard.indexOf('async function submitCommercialDecision()')
const acceptanceEnd = wizard.indexOf('async function downloadCurrentQuote()', acceptanceStart)
const acceptance = wizard.slice(acceptanceStart, acceptanceEnd)
const panelStart = wizard.indexOf('<div v-if="commercialAction === \'accept\'"')
const panelEnd = wizard.indexOf('<div v-if="editingRate.status === \'QUOVinculada\'"', panelStart)
const panel = wizard.slice(panelStart, panelEnd)

test('accepting a QUO never sends or requests a manual IDTRA', () => {
  assert.ok(acceptanceStart >= 0 && acceptanceEnd > acceptanceStart)
  assert.ok(panelStart >= 0 && panelEnd > panelStart)
  assert.match(acceptance, /status: 'AcceptedByClient'/)
  assert.doesNotMatch(acceptance, /idtraNumber\s*:/)
  assert.doesNotMatch(panel, /v-model="commercialIdtra"|Números IDTRA \(separados/)
  assert.match(panel, /Operations.*crear la apertura|asignar automáticamente el IDTRA/s)
  assert.match(panel, /v-model="commercialOtherReferences"/)
})

test('historical IDTRA values stay read only in the quotation preview', () => {
  assert.doesNotMatch(wizard, /v-model="form\.idtraNumber"/)
  assert.match(wizard, /IDTRA históricos asociados a Dynamics \(solo lectura\)/)
  assert.match(wizard, /wizardIdtraIdentifiers/)
})
