import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../build/pricingLclCostBreakdownUi.ts', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('POL chino sin tarifa: Pantalla 5 solo selecciona el consolidado y cotiza el diferencial correcto', () => {
  assert.match(selector, /function ownFallback\(row:/)
  assert.match(selector, /useUnlistedChinaOriginFallback: ownFallback\(row\)/)
  assert.match(preview, /useUnlistedChinaOriginFallback: ownFallback\(row\)/)
  assert.doesNotMatch(selector, /fallbackPickupCost|fallbackPickupSale|label="Costo recolecta \(USD\)"/)
})

test('POL chino sin tarifa: recolecta aparece editable en grupo de Pantalla 7', () => {
  assert.match(selector, /lines: mapOwnLines\(calculation, ownFallback\(row\)\)/)
  assert.match(selector, /manual: fallbackPickupLine \? false : variable/)
  assert.match(selector, /LCL ORIGEN SIN TARIFA · RECOLECTA OBLIGATORIA/)
  assert.match(wizard, /missingLclOriginPickup/)
  assert.match(wizard, /'Recolecta de origen pendiente'/)
})
