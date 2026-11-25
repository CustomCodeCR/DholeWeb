import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { historicalIdtra, resolveRateOperationsIdtras } from '../src/modules/pricing/utils/rateOperationsIdtras.ts'

const row = (idtra, parent = 'quote', option = 'quote', apertureType = 'AUTOMATIC') => ({
  idtra, sourceQuoteId: parent, sourceQuoteOptionId: option, apertureType,
})
const page = items => ({ items, total: items.length, page: 1, pageSize: 25 })
const noGroup = async () => null

test('accepted QUO resolves its Operations IDTRA without a historical Pricing field', async () => {
  const result = await resolveRateOperationsIdtras({ id: 'quote' }, noGroup, async (p, filters) => {
    assert.equal(p, 1)
    assert.deepEqual(filters, { q: 'quote', apertureType: 'AUTOMATIC' })
    return page([row('IDTRA12967'), row('IDTRA99999', 'other'), row('IDTRA123', 'quote', 'other'), row('IDTRA42', 'quote', 'quote', 'MANUAL')])
  })
  assert.deepEqual(result, { state: 'found', idtras: ['IDTRA12967'] })
})

test('selected group option can have several distinct IDTRAs across pages', async () => {
  const result = await resolveRateOperationsIdtras({ id: 'parent', groupAlternativeCount: 2 },
    async () => ({ parentRateId: 'parent', selectedRateId: 'B', alternatives: [{ rateId: 'parent' }, { rateId: 'B' }] }),
    async p => ({ items: p === 1 ? [row('IDTRA20', 'parent', 'B'), row('IDTRA999', 'parent', 'parent')] : [row('IDTRA10', 'parent', 'B'), row('IDTRA20', 'parent', 'B')], total: 26, page: p, pageSize: 25 }))
  assert.deepEqual(result, { state: 'found', idtras: ['IDTRA10', 'IDTRA20'] })
})

test('missing, inaccessible and historical IDTRA remain distinct', async () => {
  assert.deepEqual(await resolveRateOperationsIdtras({ id: 'quote' }, noGroup, async () => page([])), { state: 'missing' })
  assert.deepEqual(await resolveRateOperationsIdtras({ id: 'quote' }, noGroup, async () => { throw new Error('403') }), { state: 'error' })
  assert.equal(historicalIdtra('Pendiente de asignar'), '')
  assert.equal(historicalIdtra('IDTRA1, IDTRA2'), 'IDTRA1, IDTRA2')
})

test('desktop and mobile use the resolved display and never show manual assignment', () => {
  const source = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')
  assert.equal((source.match(/IDTRA: \{\{ displayIdtra\(row\) \}\}/g) || []).length, 2)
  assert.doesNotMatch(source, /canAssignIdtra|PricingAssignIdtraModal|Pendiente de IDTRA/)
  assert.match(source, /useOperationsDashboardRealtime\(queueOperationsIdtraRefresh\)/)
  assert.match(source, /prefixes: \['\/api\/operations'\]/)
})
