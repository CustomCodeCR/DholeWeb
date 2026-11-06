import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeServiceVersion, readHealthVersion, readReleaseVersions } from '../src/core/services/monitoringVersions.ts'

test('accepts genuine SemVer and rejects non-version health data', () => {
  assert.equal(normalizeServiceVersion('v1.3.0'), '1.3.0')
  assert.equal(normalizeServiceVersion('1.3.0'), '1.3.0')
  assert.equal(normalizeServiceVersion('Healthy'), null)
  assert.equal(normalizeServiceVersion('v1'), null)
})

test('runtime version is parsed from health body or headers', () => {
  assert.equal(readHealthVersion({ status: 'Healthy', version: '1.2.5' }), '1.2.5')
  assert.equal(readHealthVersion({ build: { version: '2.0.0' } }), '2.0.0')
  assert.equal(readHealthVersion({}, {get: name => name === 'X-Dhole-Version' ? '1.3.0' : null}), '1.3.0')
  assert.equal(readHealthVersion({status: 'Healthy'}), null)
})

test('registry only accepts known format and never invents missing versions', () => {
  assert.deepEqual(readReleaseVersions({ services: [
    {key:'gateway',version:'1.3.0'}, {key:'ai',version:'1.3.2'},
    {key:'hermes',version:null}, {key:'bad/key',version:'2.0.0'},
  ]}), {gateway:'1.3.0',ai:'1.3.2'})
  assert.deepEqual(readReleaseVersions({}), {})
})
