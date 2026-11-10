import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(path,'utf8')
const account = read('src/modules/crm/components/CrmAccountHub.vue')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
const collaboration = read('src/modules/crm/components/CrmActivityCollaboration.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')

test('account uses a single New Activity action and shared calendar form', () => {
  assert.match(account,/Nueva actividad/)
  assert.match(account,/calendarRef\.value\?\.openCreation\(\)/)
  assert.doesNotMatch(account,/newActivity\('CALL'\)/)
  assert.doesNotMatch(account,/newActivity\('VISIT'\)/)
  assert.doesNotMatch(account,/newActivity\('FOLLOWUP'\)/)
  assert.doesNotMatch(account,/<DhDrawer :open="Boolean\(editor\)"/)
})

test('meeting minutes and only linked account contacts are sent in activity creation', () => {
  for(const expected of [
    'participantContactIds: selectedContactIds.value',
    'minutes: data.minutes.trim() || null',
    'selectedContactIds',
    "crmPath('accounts', editor.value.accountId, 'contacts')",
    'min-h-48 resize-y',
    'defineExpose({ openCreation })',
  ]) assert.ok(calendar.includes(expected), expected)
  assert.match(calendar,/type="checkbox" :value="String\(contact.id\)"/)
})

test('all permitted active sellers can be selected while backend remains authoritative', () => {
  for(const expected of [
    "can('crm.activity.read-all')",
    'can(AUTH_SCOPES.users.view)',
    'UsersService.browsePaged',
    'assigneeLabel(owner)',
    'ownerUserId: data.ownerId || auth.userId',
  ]) assert.ok(calendar.includes(expected), expected)
})

test('derived commitments can be checked, reopened, and traced to originating activity', () => {
  assert.match(collaboration,/Compromisos derivados de esta actividad/)
  assert.match(collaboration,/item.status === 'Completed'/)
  assert.match(collaboration,/completed \? 'reopen' : 'complete'/)
  assert.match(collaboration,/crmPath\('activities',props.activityId,'commitments'\)/)
  assert.match(detail,/crmPath\('followups', id.value, 'origin'\)/)
  assert.match(detail,/Actividad principal asociada/)
})
