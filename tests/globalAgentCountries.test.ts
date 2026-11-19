import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isGlobalCountryAgent,
  withGlobalCountryCoverage,
} from '../src/modules/catalogs/utils/globalAgentCountries.ts'

test('GCF is worldwide even before its legacy metadata is resaved', () => {
  assert.equal(isGlobalCountryAgent({ code: 'GCF', metadataJson: '{"countries":["Panamá"]}' }), true)
  assert.equal(isGlobalCountryAgent({ name: 'Grupo Castro Fallas' }), true)
  assert.equal(isGlobalCountryAgent({ name: 'GRUPO CÁSTRO FALLAS' }), true)
  assert.equal(isGlobalCountryAgent({ name: 'Agente local', metadataJson: '{"countries":["Panamá"]}' }), false)
})

test('explicit worldwide flag supports new countries without editing the agent', () => {
  assert.equal(isGlobalCountryAgent({ name: 'Otro agente', metadataJson: '{"allCountries":true}' }), true)
  assert.equal(isGlobalCountryAgent({ code: 'GCF Distribución' }), false)
})

test('persist worldwide coverage without losing other metadata or old country values', () => {
  const json = withGlobalCountryCoverage(
    '{"country":"Panamá","countries":["Panamá"],"contacts":[{"name":"Oficina"}]}',
    [{ name: 'Costa Rica', code: 'CR' }, { name: 'China', code: 'CN' }, { name: 'Costa Rica', code: 'CR' }],
  )
  const result = JSON.parse(json)
  assert.equal(result.allCountries, true)
  assert.ok(result.countries.length >= 249)
  assert.ok(['Panamá', 'Costa Rica', 'China', 'India', 'Japón', 'Brasil'].every((name) => result.countries.includes(name)))
  assert.ok(result.countryCodes.length >= 249)
  assert.ok(['CR', 'CN', 'IN', 'JP', 'BR', 'US', 'PA'].every((code) => result.countryCodes.includes(code)))
  assert.equal(result.country, 'Panamá')
  assert.deepEqual(result.contacts, [{ name: 'Oficina' }])
})

test('catalog load failure does not remove worldwide coverage', () => {
  const result = JSON.parse(withGlobalCountryCoverage(null, []))
  assert.equal(result.allCountries, true)
  assert.ok(result.countries.length >= 249)
  assert.ok(result.countryCodes.length >= 249)
})
