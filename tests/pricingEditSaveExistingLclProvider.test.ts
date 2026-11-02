import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('existing LCL keeps persisted agent and may save without catalog naviera', () => {
  assert.match(wizard, /const existingLcl = editingRate\.value/)
  assert.match(wizard, /existingLcl\.agentId/)
  assert.match(wizard, /'00000000-0000-0000-0000-000000000000'/)
  assert.match(wizard, /const carrierName = carrier \? displayValue\(carrier\) : \(existingLcl \? 'No aplica \(LCL\)'/)
  assert.match(wizard, /agentId: agentId!/)
  assert.match(wizard, /carrierId: carrierId!/)
})

test('all edit-mode LCL tariffs preserve saved freight when hydration loses it', () => {
  assert.match(wizard, /const persistedFreight = editingRate\.value\?\.shipmentMode === 'Lcl'/)
  assert.match(wizard, /detailId: persistedFreight\.id/)
})

test('missing reference rejection is visible instead of silently ignoring save', () => {
  assert.match(wizard, /toastStore\.warning\('No se puede guardar todavía'/)
})
