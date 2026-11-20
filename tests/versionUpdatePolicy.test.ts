import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldShowVersionUpdateNotice } from '../src/core/version/versionUpdatePolicy.ts'

test('global disable overrides every user setting', () => {
  for (const user of [true, false, null]) {
    assert.equal(shouldShowVersionUpdateNotice(false, user), false)
  }
})

test('individual disable suppresses only that user', () => {
  assert.equal(shouldShowVersionUpdateNotice(true, false), false)
  assert.equal(shouldShowVersionUpdateNotice(true, true), true)
  assert.equal(shouldShowVersionUpdateNotice(true, null), true)
})
