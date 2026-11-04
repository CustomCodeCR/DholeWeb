import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyFreightUnitAmount, singleIncludedFreightLine } from '../src/modules/pricing/utils/pricingFreightUnitSync.ts'

const wizard = readFileSync(
  new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
  'utf8',
)

test('the user-entered 4.92 cost and 5.10 sale per kg reach the persisted LCL freight row', () => {
  const freight = {
    detailId: 'b4aac583-4438-4a8d-ab65-c51a39b1a87e',
    costDetailType: 'Freight', included: true, chargeBasis: 'PerKg',
    quantity: 54.8847, costAmount: 0.04, saleAmount: 0.10,
  }
  const destination = {
    detailId: 'another-detail', costDetailType: 'DestinationCharge',
    included: true, chargeBasis: 'PerShipment', quantity: 1,
    costAmount: 25, saleAmount: 50,
  }
  const lines = [freight, destination]
  assert.equal(applyFreightUnitAmount(lines, 'costAmount', 4.92), 4.92)
  assert.equal(applyFreightUnitAmount(lines, 'saleAmount', 5.1), 5.1)
  assert.equal(singleIncludedFreightLine(lines), freight)
  assert.equal(freight.costAmount, 4.92)
  assert.equal(freight.saleAmount, 5.1)
  assert.equal(freight.chargeBasis, 'PerKg')
  assert.equal(freight.detailId, 'b4aac583-4438-4a8d-ab65-c51a39b1a87e')
  assert.equal(Math.round(freight.costAmount * freight.quantity * 100) / 100, 270.03)
  assert.equal(Math.round(freight.saleAmount * freight.quantity * 100) / 100, 279.91)
  assert.equal(destination.costAmount, 25)
  assert.equal(destination.saleAmount, 50)
})

test('multiple freight rows cannot overwrite one another and invalid amounts are rejected', () => {
  const a = { costDetailType: 'Freight', included: true, costAmount: 1, saleAmount: 2 }
  const b = { costDetailType: 'Freight', included: true, costAmount: 3, saleAmount: 4 }
  assert.equal(singleIncludedFreightLine([a, b]), null)
  assert.equal(applyFreightUnitAmount([a, b], 'saleAmount', 5.1), 5.1)
  assert.deepEqual([a.saleAmount, b.saleAmount], [2, 4])
  assert.equal(applyFreightUnitAmount([a], 'costAmount', -1), null)
  assert.equal(applyFreightUnitAmount([a], 'costAmount', 'invalid'), null)
  assert.equal(a.costAmount, 1)
  assert.equal(applyFreightUnitAmount([a], 'costAmount', 0), 0)
})

test('the wizard binds provider fields to freight details and verifies saved air prices', () => {
  assert.match(wizard, /v-model\.number="form\.freightCost"/)
  assert.match(wizard, /v-model\.number="form\.freightSale"/)
  assert.match(wizard, /applyFreightUnitAmount\(/)
  assert.match(wizard, /form\.freightCost = number\(amounts\[0\]\)/)
  assert.match(wizard, /form\.freightSale = number\(amounts\[1\]\)/)
  assert.match(wizard, /const requestedAirFreight = updatePayload\.extraDetails\.find/)
  assert.match(wizard, /Math\.abs\(number\(savedAirFreight\.costAmount\) - number\(requestedAirFreight\.costAmount\)\)/)
  assert.match(wizard, /Math\.abs\(number\(savedAirFreight\.saleAmount\) - number\(requestedAirFreight\.saleAmount\)\)/)
})
