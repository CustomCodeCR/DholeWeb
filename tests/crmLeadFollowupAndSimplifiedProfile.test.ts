import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
const editor = read('src/modules/crm/components/CrmAccountEditor.vue')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')

test('Prospect detail no longer requests the non-existent nested activities route', () => {
  assert.ok(detail.includes("if (section.value === 'leads') return []"))
  assert.ok(detail.includes('<CrmSalesCalendar :lead-id="id"'))
  assert.ok(calendar.includes('leadId: props.leadId || undefined'))
  assert.ok(calendar.includes('leadId: props.leadId'))
})
test('Prospect can be searched and selected for calendar appointments', () => {
  assert.ok(calendar.includes("crmList('leads', { q: leadQuery.value.trim()"))
  assert.ok(calendar.includes('void searchLeads()'))
  assert.ok(calendar.includes('Prospecto (si no hay cuenta)'))
  for (const type of ['VISIT', 'CALL', 'FOLLOWUP'])
    assert.ok(calendar.includes("value: '" + type + "'"))
})
test('Converting a prospect uses saved identification, never asks to type it twice', () => {
  assert.ok(detail.includes('record.taxId'))
  assert.ok(detail.includes('populateLeadTaxType()'))
  assert.ok(detail.includes('Hacienda no devolvió'))
  assert.ok(detail.includes("crmPath('leads', id.value, 'convert')"))
})
test('Company editing exposes only practical contact fields but retains old values', () => {
  assert.ok(editor.includes("['phone', 'Teléfono corporativo']"))
  assert.ok(editor.includes("['email', 'Correo electrónico']"))
  assert.ok(editor.includes("['website', 'Sitio web']"))
  assert.ok(!editor.includes("id: 'strategy'"))
  assert.ok(!editor.includes("id: 'operations'"))
  assert.ok(editor.includes('historicalProfileKeys'))
  assert.ok(hub.includes('visibleProfileFields'))
  assert.ok(hub.includes("['phone', 'email', 'website']"))
  assert.ok(hub.includes('Object.fromEntries(profileFields.map('))
})
