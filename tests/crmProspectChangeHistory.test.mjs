import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const view = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const accountHub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')

test('prospects have change history separate from route history', () => {
  assert.match(view, /key: 'history' as const, label: 'Historial de rutas'/)
  assert.match(view, /key: 'changes' as const, label: 'Historial de cambios'/)
  assert.match(view, /leadTab === 'changes'/)
  assert.match(view, /crm-lead-panel-changes/)
  assert.match(view, /crm-lead-panel-history/)
})
test('same account timeline interaction with protected API, actor and before-after values', () => {
  assert.match(accountHub, /<details class="group/)
  assert.match(view, /<details class="group/)
  assert.match(view, /crmPath\('leads', leadId, 'change-history'\)/)
  assert.match(view, /entry.actorDisplayName/)
  assert.match(view, /leadAuditValue\(change.before, change.field\)/)
  assert.match(view, /leadAuditValue\(change.after, change.field\)/)
  assert.match(view, /<DhPagination v-if="leadChangesTotal > 0"/)
  assert.match(view, /resetLeadChanges\(\)/)
  assert.match(view, /generation !== leadChangesGeneration/)
})
