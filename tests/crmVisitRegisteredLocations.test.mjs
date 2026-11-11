import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const map = read('src/modules/crm/components/CrmVisitMapPicker.vue')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
const editor = read('src/modules/crm/components/CrmActivityFullEditor.vue')
const lead = read('src/modules/crm/components/CrmLeadLocations.vue')
const details = read('src/modules/crm/views/CrmRecordDetailView.vue')

test('Geoapify autocompletion falls back to full text search', () => {
  assert.match(map, /queryGeocoder\(kind, params, signal\)/)
  assert.match(map, /\['autocomplete', 'search'\]/)
  assert.match(map, /\['search', 'autocomplete'\]/)
  assert.match(map, /geocode\/.*kind/)
  assert.match(map, /@keydown\.enter\.prevent="searchNow\(true\)"/)
  assert.match(map, /@click="searchNow\(true\)"/)
  assert.match(map, /HTTP 429/)
  assert.match(map, /HTTP 400/)
})

test('registered locations load only for the linked account or prospect', () => {
  assert.match(map, /crmPath\('accounts', accountId, 'addresses'\)/)
  assert.match(map, /crmPath\('leads', leadId, 'addresses'\)/)
  assert.match(map, /registeredGeneration/)
  assert.match(map, /registeredLocations\.value = \[\]/)
  assert.match(map, /selectRegisteredLocation/)
  assert.match(map, /data-crm-registered-locations/)
  assert.match(map, /registeredGeocodeAbort\?\.abort\(\)/)
})

test('selected subject drives saved address choices and clears previous point', () => {
  assert.match(calendar, /:account-id="editor\.accountId"/)
  assert.match(calendar, /:lead-id="editor\.leadId"/)
  assert.match(calendar, /editor\.value\.locationLatitude = null/)
  assert.match(editor, /:account-id="String\(activity\.accountId/)
  assert.match(editor, /:lead-id="String\(activity\.leadId/)
})

test('prospect locations can be saved and edited through authorized CRM endpoints', () => {
  assert.match(lead, /crmPath\('leads', props\.leadId, 'addresses'\)/)
  assert.match(lead, /crmPath\('lead-addresses', editingId\.value\)/)
  assert.match(lead, /<CrmVisitMapPicker v-model="location"/)
  assert.match(details, /CrmLeadLocations/)
  assert.match(details, /leadTab === 'locations'/)
})
