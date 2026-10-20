import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRateUpdateExtraDetails, stalePersistedFclFreightDetailIds } from '../src/modules/pricing/utils/pricingRateUpdateDetails.ts'
import { dedupeEquivalentReleaseLines } from '../src/modules/pricing/utils/pricingReleaseLineDeduplication.ts'

test('two different HBL costs with the same persisted ID remain distinct', () => {
  const rows = buildRateUpdateExtraDetails(
    [{ name: 'HBL', costId: 'cost-a', saleAmount: 0 }, { name: 'HBL', costId: 'cost-b', saleAmount: 0 }],
    [{ detailId: 'detail-1' }, { detailId: 'detail-1' }],
    [{ id: 'detail-1', costId: 'cost-b' }],
  )
  assert.deepEqual(rows.map((row) => row.id), [null, 'detail-1'])
  assert.deepEqual(rows.map((row) => row.costId), ['cost-a', 'cost-b'])
})

test('an identical duplicated snapshot is only sent once', () => {
  const row = { name: 'HBL', costId: 'cost-a', saleAmount: 0 }
  const rows = buildRateUpdateExtraDetails(
    [row, { ...row }],
    [{ detailId: 'detail-1' }, { detailId: 'detail-1' }],
    [{ id: 'detail-1', costId: 'cost-a' }],
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.id, 'detail-1')
})

test('manual lines with different amounts are not silently merged', () => {
  const rows = buildRateUpdateExtraDetails(
    [{ costId: null, saleAmount: 50 }, { costId: null, saleAmount: 80 }],
    [{ detailId: 'detail-1' }, { detailId: 'detail-1' }],
    [{ id: 'detail-1', costId: null }],
  )
  assert.deepEqual(rows.map((row) => row.id), ['detail-1', null])
  assert.deepEqual(rows.map((row) => row.saleAmount), [50, 80])
})

test('replacing 40HC and 40NOR by two 40NOR removes only the obsolete freight', () => {
  const removed = stalePersistedFclFreightDetailIds(
    'Fcl',
    [
      { id: 'freight-40hc', costDetailType: 'Freight' },
      { id: 'freight-40nor', costDetailType: 'Freight' },
      { id: 'destination-charge', costDetailType: 'CarrierCharge' },
    ],
    [
      { detailId: 'freight-40nor', costDetailType: 'Freight' },
      { detailId: 'destination-charge', costDetailType: 'CarrierCharge' },
    ],
  )
  assert.deepEqual([...removed], ['freight-40hc'])
})

test('equipment replacement with a new freight row removes its former freight', () => {
  const removed = stalePersistedFclFreightDetailIds(
    'Fcl',
    [{ id: 'freight-old', costDetailType: 'Freight' }],
    [{ detailId: null, costDetailType: 'Freight' }],
  )
  assert.deepEqual([...removed], ['freight-old'])
})

test('non-FCL updates never infer equipment freight deletions', () => {
  const removed = stalePersistedFclFreightDetailIds(
    'Lcl',
    [{ id: 'freight-old', costDetailType: 'Freight' }],
    [],
  )
  assert.equal(removed.size, 0)
})

test('identical Release charges from different catalog CostIds are only shown once', () => {
  const lines = [
    { name: 'Release', costId: 'cost-one', costDetailType: 'CarrierCharge', costType: 'Fixed', chargeBasis: 'PerShipment', currencyCode: 'USD', costAmount: 75, saleAmount: 0 },
    { name: ' Release ', costId: 'cost-two', costDetailType: 'CarrierCharge', costType: 'Fixed', chargeBasis: 'PerShipment', currencyCode: 'USD', costAmount: 75, saleAmount: 0 },
  ]
  assert.deepEqual(dedupeEquivalentReleaseLines(lines), [lines[0]])
})

test('Release charges with different values or tax configuration remain separate', () => {
  const base = { name: 'Release', costDetailType: 'CarrierCharge', costType: 'Fixed', chargeBasis: 'PerShipment', currencyCode: 'USD', costAmount: 75, saleAmount: 0 }
  const lines = [base, { ...base, costAmount: 90 }, { ...base, applyDestinationTax: true, destinationTaxRate: 13 }]
  assert.equal(dedupeEquivalentReleaseLines(lines).length, 3)
})

test('two distinct Manejos lines are preserved', () => {
  const lines = [
    { name: 'Manejos', costAmount: 0, saleAmount: 55 },
    { name: 'Manejos', costAmount: 50, saleAmount: 0 },
  ]
  assert.deepEqual(dedupeEquivalentReleaseLines(lines), lines)
})
