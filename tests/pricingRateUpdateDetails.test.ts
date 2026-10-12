import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRateUpdateExtraDetails } from '../src/modules/pricing/utils/pricingRateUpdateDetails.ts'

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
