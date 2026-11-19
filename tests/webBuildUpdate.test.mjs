import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeWebBuild, requiresWebUpdate, webBuildKey } from '../src/core/version/webBuildUpdate.ts'

const installed = { version: '1.89.0', commit: 'ab1234' }

test('only valid semantic release manifests are accepted', () => {
  assert.deepEqual(normalizeWebBuild({ version: '1.89.1', commit: ' cd5678 ' }), { version: '1.89.1', commit: 'cd5678' })
  assert.equal(normalizeWebBuild('<html>SPA fallback</html>'), null)
  assert.equal(normalizeWebBuild({ version: 'nope' }), null)
})

test('a changed SemVer or deployment commit requires user-initiated refresh', () => {
  assert.equal(requiresWebUpdate(installed, { version: '1.89.1', commit: 'ab1234' }), true)
  assert.equal(requiresWebUpdate(installed, { version: '1.89.0', commit: 'cd5678' }), true)
  assert.equal(requiresWebUpdate(installed, { version: '1.89.0', commit: 'ab1234' }), false)
  assert.equal(requiresWebUpdate(installed, { version: '1.89.0' }), false)
  assert.equal(requiresWebUpdate(installed, {}), false)
  assert.equal(webBuildKey(installed), '1.89.0:ab1234')
})
