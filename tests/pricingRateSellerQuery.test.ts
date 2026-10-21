import assert from 'node:assert/strict'
import test from 'node:test'
import { appendExecutiveNameFilters } from '../src/modules/pricing/utils/rateSellerQuery.ts'

test('multiple sales executives are encoded as separate query parameters', () => {
  const path = appendExecutiveNameFilters('/api/pricing/rates?pageNumber=2', ['María López', 'José Castro'])
  const query = new URLSearchParams(path.split('?')[1])
  assert.equal(query.get('pageNumber'), '2')
  assert.deepEqual(query.getAll('executiveNames'), ['María López', 'José Castro'])
})

test('empty or blank selection adds no filter', () => {
  assert.equal(appendExecutiveNameFilters('/api/pricing/rates', []), '/api/pricing/rates')
  assert.equal(appendExecutiveNameFilters('/api/pricing/rates?status=Open', ['  ']), '/api/pricing/rates?status=Open')
})

test('sales executives are individually trimmed and safely URL-encoded', () => {
  const path = appendExecutiveNameFilters('/api/pricing/rates', ['  Ana & Luis  ', 'A/B'])
  assert.deepEqual(new URLSearchParams(path.split('?')[1]).getAll('executiveNames'), ['Ana & Luis', 'A/B'])
})
