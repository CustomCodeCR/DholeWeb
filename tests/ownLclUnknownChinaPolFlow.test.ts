import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isChinaOwnLclPol, isOwnLclPoeEligible } from '../src/modules/pricing/utils/ownLclPoeEligibility.ts'

const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
const preview = readFileSync(new URL('../build/pricingLclCostBreakdownUi.ts', import.meta.url), 'utf8')
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const apiContract = readFileSync(new URL('../src/core/services/ownLclConsolidationService.ts', import.meta.url), 'utf8')

test('Shanghai pickup fallback solo para POL de China; nunca otros países', () => {
  assert.equal(isChinaOwnLclPol('POL-2026-666', 'Wuhan, China'), true)
  assert.equal(isChinaOwnLclPol('POL-2026-667', 'Xian, Shaanxi, China'), true)
  assert.equal(isChinaOwnLclPol('CNWUH', 'Wuhan'), true)
  assert.equal(isChinaOwnLclPol('POL-2026-001', 'Tokyo, Japan'), false)
  assert.equal(isChinaOwnLclPol('USMIA', 'Miami, Estados Unidos'), false)
  assert.equal(isChinaOwnLclPol('NLRTM', 'Rotterdam, Netherlands'), false)
  assert.equal(isChinaOwnLclPol('POL-2026-100', 'Wuhan'), false)
  assert.equal(isChinaOwnLclPol(null, ''), false)
  assert.equal(isOwnLclPoeEligible('USMIA', 'Miami, Estados Unidos', 'PABLB', 'Balboa, Panamá'), false)
  assert.match(selector, /isChinaOwnLclPol\(props\.polCode, props\.polName\)/)
  assert.match(selector, /isOwnLclPoeEligible\(props\.polCode, props\.polName, props\.poeCode, props\.poeName\)/)
  assert.match(selector, /useShanghaiPickupFallback: ownFallback\(row\)/)
  assert.match(preview, /useShanghaiPickupFallback: ownFallback\(row\)/)
  assert.match(apiContract, /useShanghaiPickupFallback\?: boolean/)
  assert.doesNotMatch(selector, /fallbackPickupCost|fallbackPickupSale|label="Costo recolecta \(USD\)"/)
})

test('La recolecta de Wuhan a Shanghai se cobra como línea editable de Pantalla 7', () => {
  assert.match(selector, /Recolecta \$\{props\.polName \|\| props\.polCode \|\| 'POL seleccionado'\} → Shanghai, China/)
  assert.match(selector, /lines: mapOwnLines\(calculation, ownFallback\(row\)\)/)
  assert.match(selector, /manual: fallbackPickupLine \? false : variable/)
  assert.match(selector, /LCL ORIGEN SIN TARIFA · RECOLECTA OBLIGATORIA/)
  assert.match(wizard, /missingLclOriginPickup/)
  assert.match(wizard, /'Recolecta de origen pendiente'/)
})
