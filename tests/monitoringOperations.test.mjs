import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const file = readFileSync(new URL('../src/core/services/monitoringService.ts', import.meta.url), 'utf8')

test('Operations is a critical monitored service through Gateway', () => {
  assert.match(file, /key:\s*'operations'[\s\S]*?url:\s*buildGatewayHealthUrl\('operations'\)[\s\S]*?critical:\s*true/)
})

test('Monitoring differentiates actual version from release manifest fallback', () => {
  assert.match(file, /versions\[service\.key\]/)
  assert.match(file, /versionSource:\s*reportedVersion\s*\?\s*'runtime'\s*:\s*registeredVersion\s*\?\s*'registered'/)
})
