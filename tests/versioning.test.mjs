import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { parseVersion, bumpVersion } from '../scripts/semver.mjs'

test('MAJOR.MINOR.PATCH are valid, including zero', () => {
  assert.deepEqual(parseVersion('0.0.0'), { major: 0, minor: 0, patch: 0 })
  assert.deepEqual(parseVersion('12.34.56'), { major: 12, minor: 34, patch: 56 })
})

test('rejects invalid and ambiguous semantic versions', () => {
  for (const version of ['v1.2.3', '1.2', '1.2.3-beta', '1.2.3.4', '01.2.3', '1.-2.3', '1.2.a']) {
    assert.throws(() => parseVersion(version), /Invalid version/)
  }
})

test('increments only the selected level and resets lower components', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4')
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0')
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0')
  assert.throws(() => bumpVersion('1.2.3', 'build'), /Bump type/)
})
