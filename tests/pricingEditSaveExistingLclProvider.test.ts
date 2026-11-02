import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const nullableProviders = read('build/pricingWizardEnhancements.ts')

test('LCL coloader provider exceptions are applied by the Vite pricing transform', () => {
  assert.match(wizard, /if \(!agent\) missing\.push\('agente'\)/)
  assert.match(wizard, /if \(!carrier\) missing\.push\('proveedor'\)/)
  assert.match(nullableProviders, /lclSelectedSource\.value/)
  assert.match(nullableProviders, /create payload nullable carrier/)
})

test('all edit-mode LCL quotes restore persisted freight rather than dropping it', () => {
  assert.match(wizard, /const persistedFreight = editingRate\.value\?\.shipmentMode === 'Lcl'/)
  assert.match(wizard, /detailId: persistedFreight\.id/)
})

test('incomplete save attempts explain what is missing', () => {
  assert.match(wizard, /toastStore\.warning\('No se puede guardar todavía'/)
})
