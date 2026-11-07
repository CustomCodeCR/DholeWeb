import assert from 'node:assert/strict'
import test from 'node:test'
import { removeDuplicateFclFreight } from '../src/modules/pricing/utils/pricingFclFreightDeduplication.ts'

const row = (key: string, name: string, included = true) => ({
  key, name, included, costDetailType: 'Freight',
})
test('FCL keeps only the equipment-specific freight when generic freight is duplicated', () => {
  const result = removeDuplicateFclFreight([
    row('freight', 'Flete Internacional'),
    row('freight:40hc', 'Flete Internacional - 40HC'),
    { key: 'cost:documentation', name: 'Documentacion', included: true, costDetailType: 'Documentation' },
  ], 'Fcl')
  assert.deepEqual(result.map(item => item.key), ['freight:40hc', 'cost:documentation'])
})
test('FCL preserves different equipment freight rows and a single generic freight', () => {
  assert.deepEqual(removeDuplicateFclFreight([
    row('freight:20', 'Flete Internacional - 20 pies'),
    row('freight:40', 'Flete Internacional - 40HC'),
  ], 'Fcl').length, 2)
  assert.equal(removeDuplicateFclFreight([row('freight', 'Flete Internacional')], 'Fcl').length, 1)
})
test('LCL does not change historical freight', () => {
  assert.equal(removeDuplicateFclFreight([
    row('freight', 'Flete Internacional'),
    row('freight:40hc', 'Flete Internacional - 40HC'),
  ], 'Lcl').length, 2)
})
