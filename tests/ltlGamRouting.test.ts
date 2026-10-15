import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GAM_LTL_ORIGINS,
  gamLtlOrigin,
  isLtlGamPickupLocation,
  matchesLandLtlEndpoint,
} from '../src/modules/pricing/utils/ltlGamRouting.ts'

test('all four GAM locations are supported with pickup only outside San José', () => {
  assert.equal(GAM_LTL_ORIGINS.length, 4)
  for (const city of ['Alajuela', 'Heredia', 'Coyol, Alajuela']) {
    assert.equal(isLtlGamPickupLocation(city), true)
  }
  assert.equal(isLtlGamPickupLocation('San José, Costa Rica'), false)
  assert.equal(isLtlGamPickupLocation('CFZ, Panamá'), false)
  assert.equal(gamLtlOrigin('Coyol, Alajuela, Costa Rica')?.key, 'coyol')
})

test('GAM pickup origin may use own San José consolidation base', () => {
  const master = { id: 'san-jose-id', name: 'San José, Costa Rica', code: 'SJO', ids: [] }
  for (const name of ['Heredia, Costa Rica', 'Alajuela, Costa Rica', 'Coyol, Alajuela, Costa Rica']) {
    assert.equal(matchesLandLtlEndpoint(master, { id: 'other-id', name }, 'origin'), true)
  }
  assert.equal(matchesLandLtlEndpoint(master, { id: 'panama-id', name: 'CFZ, Panamá' }, 'origin'), false)
})

test('GAM pickup origin does not make specific Alajuela pricing valid for San José', () => {
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Alajuela, Costa Rica' },
    { name: 'San José, Costa Rica' },
    'origin',
  ), false)
})

test('LTL Nicaragua destination matches Managua label but not other countries', () => {
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Nicaragua', code: 'NI' },
    { name: 'Managua, Nicaragua', code: 'MGA' },
    'destination',
  ), true)
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Nicaragua' },
    { name: 'Tegucigalpa, Honduras' },
    'destination',
  ), false)
})

test('route ID and configured applicable ID match independently of display names', () => {
  assert.equal(matchesLandLtlEndpoint(
    { id: null, ids: ['origin-id'], name: 'San José' },
    { id: 'origin-id', name: 'Other alias' },
    'origin',
  ), true)
})
