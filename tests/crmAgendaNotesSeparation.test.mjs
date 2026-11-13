import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')

test('agenda has explicit client and seller search before pagination', () => {
  assert.match(workspace, /agendaClientQuery = ref\(''\)/)
  assert.match(workspace, /agendaSellerQuery = ref\(''\)/)
  assert.match(workspace, /await loadAgendaIdentityLabels\(combined\)/)
  assert.match(workspace, /crmAgendaClientName\(item, agendaIdentityLabels\.value\)/)
  assert.match(workspace, /crmAgendaExecutiveName\(item, agendaIdentityLabels\.value/)
})
test('unscheduled notes never mingle with agenda records', () => {
  assert.match(workspace, /item\._crmResource === 'activities' && !item\.scheduledStartAt/)
  assert.match(workspace, /agendaView === 'log'" view="log"/)
  assert.match(workspace, /Bitácora · Notas/)
})
test('commercial log renders note cards and server filtered client identities', () => {
  assert.match(calendar, /data-crm-commercial-notes/)
  assert.match(calendar, /event\.notes/)
  assert.match(calendar, /logClientSelection\.value\.startsWith\('a:'\)/)
  assert.match(calendar, /logClientSelection\.value\.startsWith\('l:'\)/)
  assert.match(calendar, /crmList\('activities\/bitacora'/)
  assert.match(calendar, /Abrir nota y documentos/)
})
