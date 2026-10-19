import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { belongsToMaerskGeneration, isGenerationProfileName } from '../src/modules/agent/utils/maerskGenerationProfileFilter.ts'

test('Maersk prod2 shows only its own persisted browser profiles', () => {
  assert.equal(belongsToMaerskGeneration('maersk-prod2-70cc', 'prod2'), true)
  assert.equal(belongsToMaerskGeneration('maersk-original-70cc', 'prod2'), false)
  assert.equal(belongsToMaerskGeneration('maersk-prod1-70cc', 'prod2'), false)
  assert.equal(belongsToMaerskGeneration('maersk-prod3-70cc', 'prod2'), false)
  assert.equal(belongsToMaerskGeneration('maersk-prod20-70cc', 'prod2'), false)
  assert.equal(belongsToMaerskGeneration('maersk-prod2-70cc', null), false)
  assert.equal(belongsToMaerskGeneration('maersk-prod2-70cc', 'prod2/../'), false)
})

test('Maersk operations never count retired profiles as authenticated', () => {
  assert.equal(isGenerationProfileName('Maersk prod2 - Chromium profile', 'prod2'), true)
  assert.equal(isGenerationProfileName('Maersk prod1 - original Chromium profile', 'prod2'), false)
  assert.equal(isGenerationProfileName('Maersk prod2 - Chromium profile', null), false)
})

test('both views apply generation-aware client filtering instead of trusting old API rows', async () => {
  const [profiles, operations] = await Promise.all([
    readFile(new URL('../src/modules/agent/views/AgentBrowserProfilesView.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/agent/views/MaerskOperationsView.vue', import.meta.url), 'utf8'),
  ])
  assert.match(profiles, /:rows="visibleBrowserProfiles"/)
  assert.match(profiles, /belongsToMaerskGeneration\(profile\.profileKey, activeGeneration\.value\)/)
  assert.match(operations, /const activeProfiles = computed/)
  assert.match(operations, /v-for="profile in activeProfiles"/)
})
