import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
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

test('production workflow must start on a master push with no duplicate job conditions', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8')
  assert.match(workflow, /on:\s*\n\s+push:\s*\n\s+branches: \[master\]/)
  assert.match(workflow, /\n\s+workflow_dispatch:/)
  const header = workflow.split('jobs:\n  deploy:')[1]?.split('    steps:')[0]
  assert.ok(header, 'Deployment job definition is required')
  assert.equal((header.match(/^\s+if:/gm) || []).length, 0, 'The production job must not have conflicting manual-only conditions')
  assert.match(header, /runs-on: \[self-hosted, linux, x64, dhole\]/)
})
