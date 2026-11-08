import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { ImportRateSelectDto } from '../src/core/interfaces/pricing.ts'
import { pricingRateDisplayKey, uniqueDisplayRates, uniqueVisibleFclBundles } from '../src/modules/pricing/utils/pricingRateDisplayDedup.ts'

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
  status: 'Approved',
  ...changes,
} as ImportRateSelectDto)

test('same commercial offer in multiple imported emails produces one visible tariff', () => {
  const original = sample()
  const duplicate = sample({ id: 'source-2', importBatchId: 'batch-2', status: 'PreAuthorized' })
  assert.equal(pricingRateDisplayKey(original), pricingRateDisplayKey(duplicate))
  assert.deepEqual(uniqueDisplayRates([original, duplicate]), [original])
  assert.deepEqual(uniqueDisplayRates([duplicate, original]), [original])
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

test('identical dated offers prefer approved and retain the selected source id', () => {
  const preauthorized = sample({ id: 'preauthorized', status: 'PreAuthorized' })
  const approved = sample({ id: 'approved', status: 'Approved' })
  assert.deepEqual(uniqueDisplayRates([preauthorized, approved]).map((r) => r.id), ['approved'])
  assert.deepEqual(uniqueDisplayRates([approved, preauthorized]).map((r) => r.id), ['approved'])
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

test('Screen 5 deduplicates FINAL FCL cards despite different imported source metadata', () => {
  const build = (
    id: string,
    from: string,
    overrides: Record<string, unknown> = {},
    sourceOverrides: Partial<ImportRateSelectDto> = {},
  ) => {
    const rate = sample({
      id,
      importBatchId: 'batch-' + id,
      carrierId: 'maersk',
      carrier: 'MAERSK',
      agentId: 'wvl',
      agent: 'WVL',
      freight: 6000,
      totalSale: 6000,
      validFrom: from,
      validTo: '2026-11-13',
      ...sourceOverrides,
    })
    return {
      key: 'single:' + id,
      carrierId: rate.carrierId || '',
      carrier: 'MAERSK',
      agentId: 'wvl',
      agent: 'WVL',
      currencyId: 'usd',
      currency: 'USD',
      totalCost: rate.freight,
      totalSale: rate.totalSale ?? rate.freight,
      freeDays: rate.freeDays ?? 0,
      transitDays: rate.transitDays ?? 0,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      preAuthorized: rate.status === 'PreAuthorized',
      lines: [{
        containerTypeId: '40hc',
        quantity: 1,
        unitCost: rate.freight,
        unitSale: rate.totalSale ?? rate.freight,
        rate,
      }],
      ...overrides,
    }
  }
  const older = build('maersk-nov04', '2026-11-04', {}, { spaceComment: 'Vigente en Caldera' })
  const duplicate = build('maersk-nov05', '2026-11-05', {}, { spaceComment: '' })
  // Raw import metadata differs, yet the cards show the same commercial offer.
  assert.notEqual(pricingRateDisplayKey(older.lines[0]!.rate), pricingRateDisplayKey(duplicate.lines[0]!.rate))
  assert.deepEqual(uniqueVisibleFclBundles([older, duplicate]).map(x => x.key), ['single:maersk-nov04'])
  assert.deepEqual(uniqueVisibleFclBundles([duplicate, older]).map(x => x.key), ['single:maersk-nov04'])

  const variants = [
    build('different-freight', '2026-11-05', { totalCost: 6200, totalSale: 6200, lines: [{
      ...duplicate.lines[0]!, unitCost: 6200, unitSale: 6200, rate: sample({
        ...duplicate.lines[0]!.rate, id: 'different-freight', freight: 6200, totalSale: 6200,
      }),
    }] }),
    build('different-agent', '2026-11-05', { agentId: 'other', agent: 'OTRO' }),
    build('different-route', '2026-11-05', {}, { poe: 'Moin', poeId: 'moin' }),
    build('different-equipment', '2026-11-05', { lines: [{
      ...duplicate.lines[0]!, containerTypeId: '20dc',
    }] }),
    build('different-free-days', '2026-11-05', { freeDays: 14 }),
    build('different-period', '2026-11-14', { validTo: '2026-11-20' }),
  ]
  assert.equal(uniqueVisibleFclBundles([older, ...variants]).length, variants.length + 1)
})

test('view-only saved FCL accordion is clickable despite the editing guard', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(wizard, /'wizard-view-readonly': viewOnly && step !== 9/)
  assert.match(wizard, /class="saved-quote-accordion-toggle block w-full cursor-pointer/)
  assert.match(wizard, /\.wizard-view-readonly \.saved-quote-accordion-toggle\s*\{\s*pointer-events: auto;/)
  assert.match(wizard, /@click="toggleSavedQuotePanel\(preview\.key\)"/)
  assert.match(wizard, /v-if="expandedSavedQuotePanels\[preview\.key\]"/)
  // A view must remain read-only in every other respect.
  assert.match(wizard, /\.wizard-view-readonly\s*\{\s*pointer-events: none;/)
})


test('Screen 5 MAERSK Caldera commercial aliases do not generate repeat cards', () => {
  const make = (source: ImportRateSelectDto) => ({
    key: 'single:' + source.id,
    carrierId: source.carrierId,
    carrier: source.carrier,
    agentId: source.agentId,
    agent: source.agent,
    currencyId: source.currencyId,
    currency: source.currency,
    totalCost: source.freight,
    totalSale: source.totalSale ?? source.freight,
    freeDays: source.freeDays,
    transitDays: source.transitDays ?? 0,
    validFrom: source.validFrom,
    validTo: source.validTo,
    preAuthorized: source.status === 'PreAuthorized',
    lines: [{ containerTypeId: '40hc', quantity: 1, unitCost: source.freight,
      unitSale: source.totalSale ?? source.freight, rate: source }],
  })
  const first = sample({
    id: 'maersk-caldera-04', carrierId: 'maersk', carrier: 'MAERSK',
    agentId: 'same-agent', agent: 'Agent Group', currencyId: 'usd', currency: 'USD',
    polId: 'shanghai', pol: 'Shanghai', poeId: 'caldera', poe: 'Caldera',
    podId: 'san-jose', pod: 'San José', freight: 6000, totalSale: 6000,
    freeDays: 7, transitDays: 25, spaceComment: 'Válida para carga general', validFrom: '2026-11-04', validTo: '2026-11-13',
  })
  const second = sample({
    ...first, id: 'maersk-caldera-05', importBatchId: 'different-batch',
    carrier: 'MAERSK LINE', agent: 'AGENT GROUP S.A.',
    currency: 'Dólar estadounidense', pol: 'Puerto de Shanghái',
    poe: 'Puerto Caldera, Costa Rica', pod: 'San Jose, Costa Rica',
    validFrom: '2026-11-05',
  })
  assert.deepEqual(
    uniqueVisibleFclBundles([make(first), make(second)]).map((bundle) => bundle.key),
    ['single:maersk-caldera-04'],
  )
  assert.deepEqual(
    uniqueVisibleFclBundles([make(second), make(first)]).map((bundle) => bundle.key),
    ['single:maersk-caldera-04'],
  )
  // Do not hide truly different lanes, agents, currency or commercial terms.
  const differentPort = sample({ ...second, id: 'different-port', poeId: 'moin', poe: 'Moín' })
  const differentAgent = sample({ ...second, id: 'different-agent', agentId: 'another-agent', agent: 'Another agent' })
  const differentCurrency = sample({ ...second, id: 'different-currency', currencyId: 'crc', currency: 'CRC' })
  const differentFreeDays = sample({ ...second, id: 'different-free-days', freeDays: 14 })
  const differentComments = sample({ ...second, id: 'different-terms', spaceComment: 'No incluye carga IMO' })
  const differentPrice = sample({ ...second, id: 'different-price', freight: 6100, totalSale: 6100 })
  const nonOverlapping = sample({ ...second, id: 'different-period', validFrom: '2026-11-14', validTo: '2026-11-20' })
  for (const other of [differentPort, differentAgent, differentCurrency, differentFreeDays, differentPrice, nonOverlapping]) {
    assert.equal(uniqueVisibleFclBundles([make(first), make(other)]).length, 2, other.id)
  }
  // Hidden comment differences are still selectable but not duplicate cards.
  const grouped = uniqueVisibleFclBundles([make(first), make(differentComments)])
  assert.equal(grouped.length, 1)
  assert.deepEqual(grouped[0]!.groupedAlternatives.map(x => x.key), ['single:different-terms'])
})


test('MAERSK Caldera 04/05: hidden transit and import metadata do not create duplicate visual cards', () => {
  const make = (rate: ImportRateSelectDto) => ({
    key: rate.id, carrierId: rate.carrierId, carrier: rate.carrier,
    agentId: rate.agentId, agent: rate.agent,
    currencyId: rate.currencyId, currency: rate.currency,
    totalCost: rate.freight, totalSale: rate.totalSale ?? rate.freight,
    freeDays: rate.freeDays, transitDays: rate.transitDays ?? 0,
    validFrom: rate.validFrom, validTo: rate.validTo,
    preAuthorized: rate.status === 'PreAuthorized',
    lines: [{ containerTypeId: '40hc', quantity: 1, unitCost: rate.freight,
      unitSale: rate.totalSale ?? rate.freight, rate }],
  })
  const first = sample({ id: 'maersk-04', carrierId: 'maersk', carrier: 'MAERSK',
    agentId: '', agent: '', freight: 6000, totalSale: 6000,
    freeDays: 7, transitDays: 29, validFrom: '2026-11-04',
    validTo: '2026-11-13', spaceComment: 'Primera importación',
    commodity: 'Carga general' })
  const second = sample({ ...first, id: 'maersk-05', importBatchId: 'batch-2',
    transitDays: 32, validFrom: '2026-11-05', spaceComment: 'Segundo correo',
    commodity: 'General cargo', originCharges: 45 })
  const grouped = uniqueVisibleFclBundles([make(first), make(second)])
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0]!.key, 'maersk-04')
  assert.equal(grouped[0]!.groupedAlternatives[0]!.lines[0]!.rate.id, 'maersk-05')
  assert.equal(uniqueVisibleFclBundles([make(first), make({ ...second, id: 'different-price', freight: 6100 })]).length, 2)
})


test('FCL grouping never chains non-overlapping validity periods', () => {
  const card = (id: string, from: string, to: string) => {
    const rate = sample({ id, validFrom: from, validTo: to })
    return { key: id, carrierId: rate.carrierId, carrier: 'MSC',
      agentId: rate.agentId, agent: 'AGENCY', currencyId: rate.currencyId,
      currency: 'USD', totalCost: rate.freight, totalSale: rate.totalSale ?? rate.freight,
      freeDays: rate.freeDays, transitDays: rate.transitDays ?? 0,
      validFrom: from, validTo: to, preAuthorized: false,
      lines: [{ containerTypeId: '40hc', quantity: 1, unitCost: rate.freight,
        unitSale: rate.totalSale ?? rate.freight, rate }],
    }
  }
  const rows = [card('early', '2026-11-01', '2026-11-03'),
    card('bridge', '2026-11-03', '2026-11-05'),
    card('later', '2026-11-05', '2026-11-07')]
  assert.equal(uniqueVisibleFclBundles(rows).length, 2)
})
