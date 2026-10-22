import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { buildRateUpdateExtraDetails, reconcileRateUpdateDetailChanges, stalePersistedFclFreightDetailIds } from '../src/modules/pricing/utils/pricingRateUpdateDetails.ts'

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


test('CIF edit removes old freight without also updating the same persisted ID', () => {
  const payload = reconcileRateUpdateDetailChanges(
    [
      { id: 'freight-id', costDetailType: 'Freight', name: 'Flete internacional', costId: null, saleAmount: 2500 },
      { id: 'manifest-id', costDetailType: 'DestinationCharge', name: 'Advance Manifest', costId: 'manifest-cost', saleAmount: 35 },
      { id: 'release-id', costDetailType: 'AgentCharge', name: 'Release', costId: 'release-cost', saleAmount: 75 },
    ],
    ['freight-id', 'manifest-id'],
    [
      { id: 'freight-id', costDetailType: 'Freight', costId: null },
      { id: 'manifest-id', costDetailType: 'DestinationCharge', costId: 'manifest-cost' },
      { id: 'release-id', costDetailType: 'AgentCharge', costId: 'release-cost' },
    ],
    true,
  )
  assert.deepEqual(payload.extraDetails.map((detail) => detail.name), ['Advance Manifest', 'Release'])
  assert.deepEqual(payload.extraDetails.map((detail) => detail.id), ['manifest-id', 'release-id'])
  assert.deepEqual(payload.removedExtraDetailIds, ['freight-id'])
})

test('CIF edit retains a destination charge when stale hydration assigns its old freight ID', () => {
  const payload = reconcileRateUpdateDetailChanges(
    [
      { id: 'old-freight-id', costDetailType: 'DestinationCharge', name: 'HBL', costId: 'hbl-cost', saleAmount: 50 },
      { id: 'documentation-id', costDetailType: 'DestinationCharge', name: 'Documentación', costId: 'documentation-cost', saleAmount: 140 },
    ],
    ['old-freight-id', 'documentation-id'],
    [
      { id: 'old-freight-id', costDetailType: 'Freight', costId: null },
      { id: 'documentation-id', costDetailType: 'DestinationCharge', costId: 'documentation-cost' },
    ],
    true,
  )
  assert.deepEqual(payload.extraDetails.map((detail) => detail.id), [null, 'documentation-id'])
  assert.deepEqual(payload.extraDetails.map((detail) => detail.saleAmount), [50, 140])
  assert.deepEqual(payload.removedExtraDetailIds, ['old-freight-id'])
})

test('FOB edit never deletes a persisted detail that is also being updated', () => {
  const payload = reconcileRateUpdateDetailChanges(
    [
      { id: 'freight-40hc', costDetailType: 'Freight', name: 'Flete 40HC', saleAmount: 950 },
      { id: 'hbl-id', costDetailType: 'DestinationCharge', name: 'HBL', saleAmount: 55 },
    ],
    ['hbl-id', 'freight-20dv'],
    [
      { id: 'freight-40hc', costDetailType: 'Freight' },
      { id: 'freight-20dv', costDetailType: 'Freight' },
      { id: 'hbl-id', costDetailType: 'DestinationCharge' },
    ],
    false,
  )
  assert.deepEqual(payload.extraDetails.map((detail) => detail.id), ['freight-40hc', 'hbl-id'])
  assert.deepEqual(payload.removedExtraDetailIds, ['freight-20dv'])
})

test('two charges accidentally sharing one detail ID are not sent as two updates', () => {
  const payload = reconcileRateUpdateDetailChanges(
    [
      { id: 'hbl-original', costDetailType: 'DestinationCharge', name: 'HBL', costId: 'cost-a', saleAmount: 55 },
      { id: 'hbl-original', costDetailType: 'DestinationCharge', name: 'HBL', costId: 'cost-b', saleAmount: 80 },
    ],
    ['hbl-original'],
    [{ id: 'hbl-original', costDetailType: 'DestinationCharge', costId: 'cost-a' }],
    false,
  )
  assert.deepEqual(payload.extraDetails.map((detail) => detail.id), ['hbl-original', null])
  assert.deepEqual(payload.extraDetails.map((detail) => detail.saleAmount), [55, 80])
  assert.deepEqual(payload.removedExtraDetailIds, [])
})

test('CIF without a freight detail still deletes the historical freight and leaves charges intact', () => {
  const payload = reconcileRateUpdateDetailChanges(
    [{ id: 'manejos', costDetailType: 'AgentCharge', name: 'Manejos', costId: 'rs', saleAmount: 55 }],
    [],
    [
      { id: 'freight', costDetailType: 'Freight' },
      { id: 'manejos', costDetailType: 'AgentCharge', costId: 'rs' },
    ],
    true,
  )
  assert.deepEqual(payload.extraDetails.map((detail) => detail.id), ['manejos'])
  assert.deepEqual(payload.removedExtraDetailIds, ['freight'])
  assert.equal(payload.extraDetails[0]?.saleAmount, 55)
})

test('the production wizard reconciles edit/removal IDs after building final update details', () => {
  const plugin = readFileSync(new URL('../build/pricingWizardFixedAutomaticCostEditFix.ts', import.meta.url), 'utf8')
  assert.ok(plugin.includes('reconcileRateUpdateDetailChanges('))
  assert.ok(plugin.includes('proposedRemovedExtraDetailIds'))
  assert.ok(plugin.includes('freightNotRequiredByIncoterm.value'))
})
