import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendQuoteAlternatives,
  quoteAlternativeKey,
  quoteSuffix,
  quoteSuffixIndex,
  selectQuoteAlternative,
  subQuoteNumber,
} from '../src/modules/pricing/utils/pricingQuoteAlternatives.ts'

const parent = 'QUO-00000-000600'
const option = (poeId: string, carrierId: string, haulageMode: 'Merchant' | 'Carrier' = 'Merchant') =>
  ({ poeId, carrierId, haulageMode })

test('sub-QUO suffixes continue A..Z, AA.. and retain the parent', () => {
  const samples = [[0, 'A'], [25, 'Z'], [26, 'AA'], [27, 'AB'], [701, 'ZZ'], [702, 'AAA']] as const
  for (const [index, suffix] of samples) {
    assert.equal(quoteSuffix(index), suffix)
    assert.equal(quoteSuffixIndex(suffix), index)
    assert.equal(subQuoteNumber(parent, suffix), parent + '-' + suffix)
  }
  assert.throws(() => quoteSuffix(-1))
  assert.throws(() => quoteSuffixIndex('a'))
  assert.throws(() => subQuoteNumber('QUO-X', 'A'))
})

test('two POEs and two navieras create four independent options', () => {
  const candidates = [
    option('Caldera', 'MSC'),
    option('Caldera', 'MAERSK'),
    option('Moin', 'MSC'),
    option('Moin', 'MAERSK'),
  ]
  const options = appendQuoteAlternatives(parent, candidates, [], (candidate) =>
    ({ lines: [] as string[], poe: candidate.poeId }))
  assert.deepEqual(options.map((item) => item.quoteNumber), [
    parent + '-A', parent + '-B', parent + '-C', parent + '-D',
  ])
  options[0]!.snapshot.lines.push('Flete MSC Caldera')
  assert.deepEqual(options[1]!.snapshot.lines, [])
  const reorder = appendQuoteAlternatives(parent, [...candidates].reverse(), options, () => ({ lines: [], poe: '' }))
  assert.deepEqual(reorder.map((item) => item.quoteNumber), options.map((item) => item.quoteNumber))
  assert.equal(reorder.length, 4)
})

test('identity includes haulage and route, rejecting ambiguous delimiters', () => {
  assert.notEqual(quoteAlternativeKey({ ...option('CAL', 'MSC'), routeKey: 'x|y' }),
    quoteAlternativeKey({ ...option('CAL', 'MSC'), routeKey: 'x' }))
  assert.notEqual(quoteAlternativeKey(option('CAL', 'MSC', 'Merchant')),
    quoteAlternativeKey(option('CAL', 'MSC', 'Carrier')))
  assert.throws(() => quoteAlternativeKey(option('', 'MSC')))
})

test('existing suffixes remain stable when a new alternative arrives', () => {
  const first = appendQuoteAlternatives(parent, [option('A', 'MSC'), option('B', 'MSC')], [], () => ({ value: 0 }))
  const second = appendQuoteAlternatives(parent, [option('A', 'MAERSK')], first, () => ({ value: 0 }))
  assert.deepEqual(second.map((o) => o.suffix), ['A', 'B', 'C'])
  assert.throws(() => appendQuoteAlternatives(parent, [option('A', 'MSC')], [], () => ({})))
})

test('only one alternative can be accepted, with idempotent reselection', () => {
  const initial = appendQuoteAlternatives(parent, [option('A', 'MSC'), option('B', 'MSC')], [], () => ({}))
  const chosen = selectQuoteAlternative(initial, initial[1]!.key)
  assert.deepEqual(chosen.map((o) => o.status), ['NotSelected', 'Accepted'])
  assert.deepEqual(selectQuoteAlternative(chosen, chosen[1]!.key), chosen)
  assert.throws(() => selectQuoteAlternative(chosen, chosen[0]!.key))
  assert.throws(() => selectQuoteAlternative(initial, 'unknown'))
})
