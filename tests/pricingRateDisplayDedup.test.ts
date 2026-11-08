import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { ImportRateSelectDto } from '../src/core/interfaces/pricing.ts'
import { pricingRateDisplayKey, uniqueDisplayRates } from '../src/modules/pricing/utils/pricingRateDisplayDedup.ts'

const sample = (changes: Partial<ImportRateSelectDto> = {}): ImportRateSelectDto => ({
  id: 'source-1',
  importBatchId: 'batch-1',
  polId: 'shanghai',
  poeId: 'caldera',
  podId: 'san-jose',
  carrierId: 'msc',
  agentId: 'agency',
  containerTypeId: '40hc',
  currencyId: 'usd',
  freight: 6700,
  totalSale: 6700,
  originCharges: 0,
  destinationCharges: 0,
  surcharges: 0,
  freeDays: 21,
  transitDays: 25,
  validFrom: '2026-11-01T00:00:00',
  validTo: '2026-11-07T00:00:00',
  status: 'PreApproved',
  ...changes,
} as ImportRateSelectDto)

test('same commercial offer in multiple imported emails produces one visible tariff', () => {
  const original = sample()
  const duplicate = sample({ id: 'source-2', importBatchId: 'batch-2', status: 'PreAuthorized' })
  assert.equal(pricingRateDisplayKey(original), pricingRateDisplayKey(duplicate))
  assert.deepEqual(uniqueDisplayRates([original, duplicate]), [original])
  assert.deepEqual(uniqueDisplayRates([duplicate, original]), [duplicate])
})

test('different price, agent, dates, haulage route and container remain separate offers', () => {
  const original = sample()
  const variants = [
    sample({ id: 'other-price', freight: 6900 }),
    sample({ id: 'other-agent', agentId: 'second-agent' }),
    sample({ id: 'other-validity', validFrom: '2026-11-08', validTo: '2026-11-14' }),
    sample({ id: 'other-terminal', poeId: 'moin' }),
    sample({ id: 'other-container', containerTypeId: '20dc' }),
    sample({ id: 'other-remarks', spaceComment: 'Vía otro puerto' }),
    sample({ id: 'other-charges', surcharges: 50 }),
  ]
  assert.equal(uniqueDisplayRates([original, ...variants]).length, variants.length + 1)
  assert.equal(uniqueDisplayRates([sample({ id: '' }), original]).length, 1)
})

test('Screen 5 hides identical MAERSK offers with overlapping validity but different start dates', () => {
  const wider = sample({ id: 'maersk-04', carrier: 'MAERSK', validFrom: '2026-11-04', validTo: '2026-11-13', freight: 6000, totalSale: 6000 })
  const narrower = sample({ id: 'maersk-05', carrier: 'MAERSK', validFrom: '2026-11-05', validTo: '2026-11-13', freight: 6000, totalSale: 6000 })
  assert.equal(pricingRateDisplayKey(wider), pricingRateDisplayKey(narrower))
  assert.deepEqual(uniqueDisplayRates([wider, narrower]), [wider])
  assert.deepEqual(uniqueDisplayRates([narrower, wider]), [wider])
})

test('keep the later expiration when two otherwise identical offers overlap', () => {
  const earlier = sample({ id: 'earlier', validFrom: '2026-11-04', validTo: '2026-11-10' })
  const later = sample({ id: 'later', validFrom: '2026-11-06', validTo: '2026-11-14' })
  assert.deepEqual(uniqueDisplayRates([earlier, later]), [later])
  assert.deepEqual(uniqueDisplayRates([later, earlier]), [later])
})

test('never hide distinct commercial terms or non-overlapping offers', () => {
  const base = sample()
  const genuinelyDifferent = [
    sample({ id: 'different-freight', freight: 7000 }),
    sample({ id: 'different-sale', totalSale: 7100 }),
    sample({ id: 'different-agent', agentId: 'another-agent' }),
    sample({ id: 'different-free-days', freeDays: 14 }),
    sample({ id: 'different-transit', transitDays: 32 }),
    sample({ id: 'different-route', poeId: 'moin' }),
    sample({ id: 'different-terms', spaceComment: 'Sujeto a espacio' }),
    sample({ id: 'non-overlap', validFrom: '2026-11-08', validTo: '2026-11-20' }),
  ]
  assert.equal(uniqueDisplayRates([base, ...genuinelyDifferent]).length, genuinelyDifferent.length + 1)
})

test('identical dated offers prefer preapproved and retain the selected source id', () => {
  const preauthorized = sample({ id: 'preauthorized', status: 'PreAuthorized' })
  const preapproved = sample({ id: 'preapproved', status: 'PreApproved' })
  assert.deepEqual(uniqueDisplayRates([preauthorized, preapproved]).map((r) => r.id), ['preapproved'])
  assert.deepEqual(uniqueDisplayRates([preapproved, preauthorized]).map((r) => r.id), ['preapproved'])
})

test('saved FCL group panels open and close explicitly and selected quote is primary', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const stability = readFileSync(new URL('../build/pricingWizardScreen5Stability.ts', import.meta.url), 'utf8')
  assert.match(wizard, /primarySavedGroupAlternative = computed/)
  assert.match(wizard, /const orderedSavedGroupRates = computed/)
  assert.match(wizard, /await PricingService\.selectRateGroup\(rateId\)/)
  assert.match(wizard, /@click="toggleSavedQuotePanel\(preview\.key\)"/)
  assert.match(wizard, /@click="toggleSavedQuotePanel\(subRate\.id\)"/)
  assert.match(wizard, /v-if="expandedSavedQuotePanels\[preview\.key\]"/)
  assert.match(wizard, /v-if="expandedSavedQuotePanels\[subRate\.id\]"/)
  assert.doesNotMatch(wizard, /<details v-for="preview in savedMultiQuotePreviewCards"/)
  assert.doesNotMatch(wizard, /<details v-for="subRate in orderedSavedGroupRates"/)
  assert.match(wizard, /finalizedSavedGroup \&\& option\.rateId !== savedQuoteGroup\?\.selectedRateId/)
  assert.match(wizard, /groupedQuote\?\.selectedRateId \&\& groupedQuote\.selectedRateId !== rate\.id/)
  assert.match(wizard, /router\.replace\(/)
  assert.match(stability, /uniqueDisplayRates\(\[\.\.\.requirement\.rates\]/)
})
