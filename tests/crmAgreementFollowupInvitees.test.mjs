import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')

test('Calendar does not overwrite invitations when existing guests could not be loaded', () => {
  assert.match(calendar, /const detailInviteesReady = ref\(false\)/)
  assert.match(calendar, /detailInviteesLoadError/)
  assert.match(calendar, /!detailInviteesReady\.value\) return/)
  assert.match(calendar, /:disabled="detailInviteesBusy \|\| !detailInviteesReady"/)
})

test('Calendar verifies saved invitations by reading persisted membership back from CRM', () => {
  assert.match(calendar, /const verified = await crmRequest<Array<\{ userId: string \}>>/)
  assert.match(calendar, /stored\.length !== expected\.length/)
  assert.match(calendar, /Invitados guardados y verificados en CRM/)
})

test('Followup record details render the persisted invitee count and explicitly report read failures', () => {
  assert.match(detail, /agendaFollowupInvitedIds = ref<string\[\]>/)
  assert.match(detail, /crmPath\('followups', String\(item\.id\), 'invitees'\)/)
  assert.match(detail, /\['Usuarios invitados', agendaFollowupInviteesFailed\.value/)
  assert.match(detail, /'No se pudieron consultar los invitados'/)
})
