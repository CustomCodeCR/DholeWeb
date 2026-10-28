import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { shouldIncludePricedLine } from '../src/modules/pricing/utils/pricingLineInclusion.ts'

const wizard = readFileSync(
  new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
  'utf8',
)

test('saved manual cargo insurance remains visible and billable', () => {
  const insurance = {
    detailId: 'saved-insurance-id',
    costId: null,
    manual: true,
    included: true,
    costDetailType: 'Insurance',
    costAmount: 10,
    saleAmount: 15,
  }
  assert.equal(shouldIncludePricedLine(insurance, true), true)
  assert.equal(shouldIncludePricedLine(insurance, false), true)
  assert.equal(insurance.detailId, 'saved-insurance-id')
  assert.equal(insurance.costAmount, 10)
  assert.equal(insurance.saleAmount, 15)
})

test('an included insurance row is charged once, without disabling pickup rules on other costs', () => {
  const rows = [
    { name: 'Seguro de carga', included: true, costDetailType: 'Insurance' },
    { name: 'Otro seguro no seleccionado', included: false, costDetailType: 'Insurance' },
    { name: 'Pickup condicional', included: true, costDetailType: 'InlandTransport' },
    { name: 'Port Charges', included: true, costDetailType: 'DestinationCharge' },
  ]
  const included = rows.filter((row) =>
    shouldIncludePricedLine(row, row.name === 'Port Charges'),
  )
  assert.deepEqual(included.map((row) => row.name), ['Seguro de carga', 'Port Charges'])
})

test('screen 7 renders every included insurance row from the same collection used for the quote total', () => {
  assert.match(wizard, /shouldIncludePricedLine\(line, lineMatchesPickupCargoCondition\(line\)\)/)
  assert.match(wizard, /includedLines\.value\.filter\(\(line\) => line\.costDetailType === 'Insurance'\)/)
  assert.match(wizard, /\{ key: 'insurance', label: 'Seguro de carga', lines: insuranceLines\.value \}/)
  assert.match(wizard, /line\.costDetailType !== 'Insurance'/)
  assert.doesNotMatch(wizard, /!line\.manual && line\.costDetailType === 'Insurance'/)
})
