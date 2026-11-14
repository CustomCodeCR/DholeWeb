import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const airPlugin = read('build/pricingAirLclFreightPerKg.ts')

test('own maritime LCL notes take precedence over historical air freight basis when reopening', () => {
  assert.match(wizard, /function isOwnMaritimeLclRate\(rate: RateDto\)/)
  assert.match(wizard, /LCL\\s\*PROPIO\|ConsolidadoId:.*Fuente LCL:/)
  const method = wizard.slice(wizard.indexOf('function modalityForRate('), wizard.indexOf('function transitDaysFrom('))
  assert.ok(method.indexOf("if (isOwnMaritimeLclRate(rate)) return 'Maritime'") <
    method.indexOf("const airFreight ="))
  assert.match(method, /if \(airFreight \|\| hasFlightContext \|\| airportRoute\) return 'Air'/)
})

test('only maritime own LCL freight weight bases normalize to chargeable CBM', () => {
  const block = wizard.slice(wizard.indexOf('function effectiveChargeBasisForLine('),
    wizard.indexOf('function quantityForRateLine('))
  assert.match(block, /form\.modality === 'Maritime'/)
  assert.match(block, /shipmentModeForApi\.value === 'Lcl'/)
  assert.match(block, /line\.costDetailType === 'Freight'/)
  assert.match(block, /PerKg', 'PerLb', 'Per100Kg', 'PerTon'/)
  assert.match(block, /return 'PerChargeableCbm'/)
  assert.match(wizard, /quantityForChargeBasis\(effectiveChargeBasisForLine\(line\), operationalConditionsForLine\(line\)\)/)
  assert.match(airPlugin, /if \(!isAirLclFreightContext\(\)\) return line\.chargeBasis/)
})

test('legacy air weights cannot be saved as maritime freight without a source', () => {
  assert.match(wizard, /const staleAirFreight = form\.modality === 'Maritime'/)
  assert.match(wizard, /if \(staleAirFreight\) \{[\s\S]*?step\.value = 5[\s\S]*?return/)
})

test('full quote table and Excel agree on corrected basis and persisted amounts', () => {
  assert.match(wizard, /<td class="px-4 py-3">\{\{ quoteShownBasis\(line\) \}\}<\/td>/)
  assert.match(wizard, /basis: quoteShownBasis\(line\),/)
  assert.match(wizard, /savedCommercialDetail\(line\)\?\.commercialQuantity \?\? quantityForRateLine\(line\)/)
  assert.match(wizard, /savedCommercialDetail\(line\)\?\.commercialSaleSubtotal/)
})

test('own LCL CFS is rendered and billed by minimum chargeable CBM even in legacy quotations', () => {
  const method = wizard.slice(wizard.indexOf('function effectiveChargeBasisForLine('),
    wizard.indexOf('function quantityForRateLine('))
  assert.match(method, /normalizeCatalogValue\(line\.name\) === 'cfs'/)
  assert.match(method, /ConsolidadoId:/)
  assert.match(method, /!isMiamiLcl\.value/)
  assert.match(method, /return 'PerChargeableCbm'/)
  assert.match(wizard, /return quantityForChargeBasis\(effectiveChargeBasisForLine\(line\), operationalConditionsForLine\(line\)\)/)
})
