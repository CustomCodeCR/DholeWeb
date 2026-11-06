import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../src/modules/monitoring/views/ServicesMonitoringView.vue', import.meta.url), 'utf8')
const service = readFileSync(new URL('../src/core/services/monitoringService.ts', import.meta.url), 'utf8')

test('service monitoring lists deployed versions and safe fallback', () => {
  assert.match(view, /key: 'version'/)
  assert.match(view, /#cell-version/)
  assert.match(view, /monitoring.versionUnavailable/)
})

test('version must originate from the running health response', () => {
  assert.ok(service.includes('X-Dhole-Version'))
  assert.match(service, /reportedVersion &&/)
  assert.match(service, /version: null/)
  assert.doesNotMatch(service, /github\.com|raw\.githubusercontent|version\.json/)
})
