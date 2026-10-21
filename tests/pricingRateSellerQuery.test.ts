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

import { appendRateMultiFilters } from '../src/modules/pricing/utils/rateSellerQuery.ts'

test('all categorical filters support repeated options without changing paging', () => {
  const path = appendRateMultiFilters('/api/pricing/rates?pageNumber=3&pageSize=20', {
    statuses: ['Open', 'Sent'],
    agentIds: ['agent-a', 'agent-b'],
    carrierIds: ['carrier-a', 'carrier-b'],
    polIds: ['pol-a', 'pol-b'],
    poeIds: ['poe-a', 'poe-b'],
    podIds: ['pod-a', 'pod-b'],
    containerTypeIds: ['container-a', 'container-b'],
    currencyIds: ['currency-a', 'currency-b'],
    executiveNames: ['María López', 'José Castro'],
  })
  const query = new URLSearchParams(path.split('?')[1])
  assert.equal(query.get('pageNumber'), '3')
  assert.equal(query.get('pageSize'), '20')
  for (const key of ['statuses', 'agentIds', 'carrierIds', 'polIds', 'poeIds', 'podIds', 'containerTypeIds', 'currencyIds', 'executiveNames']) {
    assert.equal(query.getAll(key).length, 2, key)
  }
  assert.deepEqual(query.getAll('executiveNames'), ['María López', 'José Castro'])
})

test('empty choices add no parameters', () => {
  assert.equal(appendRateMultiFilters('/api/pricing/rates', {
    statuses: [], agentIds: [' '], executiveNames: undefined,
  }), '/api/pricing/rates')
})
