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
    sample({ id: 'other-validity', validTo: '2026-11-14' }),
    sample({ id: 'other-terminal', poeId: 'moin' }),
    sample({ id: 'other-container', containerTypeId: '20dc' }),
    sample({ id: 'other-remarks', spaceComment: 'Vía otro puerto' }),
    sample({ id: 'other-charges', surcharges: 50 }),
  ]
  assert.equal(uniqueDisplayRates([original, ...variants]).length, variants.length + 1)
  assert.equal(uniqueDisplayRates([sample({ id: '' }), original]).length, 1)
})

test('saved FCL group panels open and close explicitly and selected quote is primary', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const stability = readFileSync(new URL('../build/pricingWizardScreen5Stability.ts', import.meta.url), 'utf8')
  assert.match(wizard, /primarySavedGroupAlternative = computed/)
  assert.match(wizard, /const orderedSavedGroupRates = computed/)
  assert.match(wizard, /await PricingService\.selectRateGroup\(rateId\)/)
  assert.match(wizard, /@click\.prevent="toggleSavedQuotePanel\(preview\.key\)"/)
  assert.match(wizard, /@click\.prevent="toggleSavedQuotePanel\(subRate\.id\)"/)
  assert.match(wizard, /:open="Boolean\(expandedSavedQuotePanels\[preview\.key\]\)"/)
  assert.match(wizard, /:open="Boolean\(expandedSavedQuotePanels\[subRate\.id\]\)"/)
  assert.match(stability, /uniqueDisplayRates\(\[\.\.\.requirement\.rates\]/)
})
