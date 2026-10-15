import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GAM_LTL_ORIGINS,
  gamLtlOrigin,
  isLtlCfzLocation,
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

test('CFZ aliases match LTL origin across different catalogue IDs', () => {
  const cfzMaster = { id: 'master-cfz', name: 'CFZ, Panamá', code: 'CFZ' }
  for (const name of [
    'Zona Libre de Colón, Panamá',
    'Zona Libre Colón',
    'Zona Franca de Colón',
    'Colon Free Zone, Panama',
    'Colón, Panamá',
  ]) {
    assert.equal(isLtlCfzLocation(name), true)
    assert.equal(matchesLandLtlEndpoint(cfzMaster, { id: 'other-catalog-id', name }, 'origin'), true)
    assert.equal(matchesLandLtlEndpoint({ name }, { name: 'CFZ, Panamá' }, 'origin'), true)
  }
})

test('CFZ tariff is not applicable to GAM or a generic Panamá origin', () => {
  const cfz = { name: 'CFZ, Panamá', code: 'CFZ' }
  for (const name of ['San José, Costa Rica', 'Alajuela, Costa Rica', 'Panamá']) {
    assert.equal(matchesLandLtlEndpoint(cfz, { name }, 'origin'), false)
  }
  assert.equal(matchesLandLtlEndpoint(
    { name: 'San José, Costa Rica' },
    { name: 'Zona Libre de Colón, Panamá' },
    'origin',
  ), false)
  assert.equal(isLtlCfzLocation('Ciudad de Panamá'), false)
})

test('CFZ own tariffs recognize the actual wizard route to Ciudad de Guatemala', () => {
  assert.equal(matchesLandLtlEndpoint(
    { name: 'CFZ Panamá', code: 'CFZ' },
    { name: 'Colon Free Zone, Panama', code: 'PA-CFZ' },
    'origin',
  ), true)
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Ciudad Guatemala, Guatemala' },
    { name: 'Ciudad de Guatemala, Guatemala' },
    'destination',
  ), true)
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Guatemala City, Guatemala' },
    { name: 'Ciudad de Guatemala, Guatemala' },
    'destination',
  ), true)
  assert.equal(matchesLandLtlEndpoint(
    { name: 'Ciudad Guatemala, Guatemala' },
    { name: 'Quetzaltenango, Guatemala' },
    'destination',
  ), false)
  assert.equal(matchesLandLtlEndpoint(
    { name: 'CFZ Panamá' },
    { name: 'San José, Costa Rica' },
    'origin',
  ), false)
})
