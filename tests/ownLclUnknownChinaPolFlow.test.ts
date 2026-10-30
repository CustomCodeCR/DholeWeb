import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../build/pricingLclCostBreakdownUi.ts', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const apiContract = readFileSync(new URL('../src/core/services/ownLclConsolidationService.ts', import.meta.url), 'utf8')

test('POL de cualquier país: la salida física Shanghai recibe recolecta sin filtro geográfico', () => {
  assert.match(selector, /const unlistedShanghaiOrigin = computed/)
  assert.match(selector, /origin !== 'shanghai'/)
  assert.match(selector, /!chinaOwnLclOrigins\.has\(origin\)/)
  assert.doesNotMatch(selector, /name\.includes\('china'\)/)
  assert.match(selector, /isBalboaOwnLclPoe\(props\.poeCode, props\.poeName\)/)
  assert.match(selector, /function ownFallback\(row:/)
  assert.match(selector, /useShanghaiPickupFallback: ownFallback\(row\)/)
  assert.match(preview, /useShanghaiPickupFallback: ownFallback\(row\)/)
  assert.match(apiContract, /useShanghaiPickupFallback\?: boolean/)
  assert.doesNotMatch(selector, /fallbackPickupCost|fallbackPickupSale|label="Costo recolecta \(USD\)"/)
})

test('Pantalla 7: recolecta del POL comercial a Shanghai, costo/venta editables y obligatorios', () => {
  assert.match(selector, /Recolecta \$\{props\.polName \|\| props\.polCode \|\| 'POL seleccionado'\} → Shanghai, China/)
  assert.match(selector, /lines: mapOwnLines\(calculation, ownFallback\(row\)\)/)
  assert.match(selector, /manual: fallbackPickupLine \? false : variable/)
  assert.match(selector, /LCL ORIGEN SIN TARIFA · RECOLECTA OBLIGATORIA/)
  assert.match(wizard, /missingLclOriginPickup/)
  assert.match(wizard, /'Recolecta de origen pendiente'/)
})
