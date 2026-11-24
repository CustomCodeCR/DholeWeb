import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const view = readFileSync('src/modules/operations/views/OperationsCasesView.vue','utf8')
const api = readFileSync('src/modules/operations/services/operationsApi.ts','utf8')
test('administrative sequence uses shared components and sends expected number plus reason', () => {
  assert.match(view, /v-if="canConfigureIdtra"/)
  assert.match(view, /auth.hasRole\(role\)/)
  assert.match(view, /<DhDrawer :open="sequenceOpen && canConfigureIdtra"/)
  assert.match(view, /Number\(sequenceNext.value\) >= sequenceCurrent.value/)
  assert.match(view, /operationsApi.configureIdtraSequence\(Number\(sequenceNext.value\), sequenceCurrent.value, sequenceReason.value.trim\(\)\)/)
  assert.match(api, /'\/api\/operations\/idtra-sequence', 'PUT', \{ nextNumber, expectedNextNumber, reason \}/)
})
