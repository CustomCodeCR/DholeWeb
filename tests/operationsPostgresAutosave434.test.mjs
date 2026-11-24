import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')

test('incomplete manual opening autosaves on PostgreSQL and keeps an offline fallback', () => {
  assert.match(opening, /operationsApi\.saveManualOpeningDraft\(remoteDraftVersion, draft\)/)
  assert.match(opening, /draftWriteQueue = draftWriteQueue\.catch\(\(\) => \{\}\)\.then/)
  assert.match(opening, /window\.localStorage\.setItem\(draftStorageKey\.value/)
  assert.match(opening, /await restoreDraft\(\)/)
  assert.match(opening, /await clearLocalDraft\(\)/)
  assert.match(api, /getManualOpeningDraft: \(\)/)
  assert.match(api, /saveManualOpeningDraft: \(expectedVersion: number/)
  assert.match(api, /clearManualOpeningDraft: \(\)/)
  assert.match(api, /'PUT', \{ expectedVersion, draft \}/)
})

test('manual-opening draft never captures actual weight or creates a case during autosave', () => {
  assert.match(opening, /weightValue: _manualWeight, weightUnit: _manualWeightUnit/)
  assert.match(opening, /No se pudo crear la apertura/)
  const persistence = opening.slice(opening.indexOf('function persistDraft()'), opening.indexOf('function scheduleLocalDraft()'))
  assert.doesNotMatch(persistence, /createAperture/)
})
