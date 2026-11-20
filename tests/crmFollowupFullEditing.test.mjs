import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const editor = readFileSync(new URL('../src/modules/crm/components/CrmFollowupFullEditor.vue', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/modules/crm/views/CrmRecordDetailView.vue', import.meta.url), 'utf8')

test('followup and reminder details expose a complete permissioned editor', () => {
  assert.match(detail, /<CrmFollowupFullEditor/)
  assert.match(detail, /can\('crm\.task\.manage'\) \|\| can\('crm\.followup\.manage'\)/)
  assert.match(editor, /data-crm-followup-full-editor/)
  assert.match(editor, /Editar seguimiento/)
})
test('editing preserves the original record and sends all reminder and invitee fields', () => {
  assert.match(editor, /crmPath\('followups', String\(props\.followup\.id\), 'details'\), 'PUT'/)
  assert.match(editor, /expectedVersion: Number\(props\.followup\.rowVersion/)
  for (const key of ['subject','assignedUserId','channel','startAt','dueAt',
    'reminderLeadMinutes','reminderChannelStrategy','inviteeUserIds'])
    assert.match(editor, new RegExp(key + ':'))
  assert.match(editor, /@saved="load"/.test(detail) ? /emit\('saved'\)/ : /emit\('saved'\)/)
})
test('invited users must load before editing can be saved, avoiding silent removal', () => {
  assert.match(editor, /inviteesLoaded\.value = false/)
  assert.match(editor, /crmPath\('followups', String\(props\.followup\.id\), 'invitees'\)/)
  assert.match(editor, /!inviteesLoaded\.value/)
  assert.match(editor, /new Set\(invitedIds\.value\)/)
})
test('existing reminders are updated with local dates and safe draft recovery', () => {
  assert.match(editor, /useCrmDraftAutosave/)
  assert.match(editor, /toUtc\(form\.dueAt\)/)
  assert.match(editor, /toUtc\(form\.startAt\)/)
  assert.match(editor, /start >= due/)
  assert.match(editor, /due < Date\.now\(\)/)
})
