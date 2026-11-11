import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const map = read('src/modules/crm/components/CrmVisitMapPicker.vue')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
const fullEditor = read('src/modules/crm/components/CrmActivityFullEditor.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
test('Geoapify map supports autocomplete search reverse geocoding tiles and markers', () => {
  for (const pattern of [/geocode\/.*kind/, /geocode\/reverse/, /maps\.geoapify\.com/, /onPointerUp/, /marker/, /attribution|openstreetmap\.org\/copyright/i])
    assert.match(map, pattern)
  assert.match(map, /const apiKey = '[a-f0-9]{32}'/)
  assert.doesNotMatch(map, /import\.meta\.env\.VITE_GEOAPIFY_API_KEY/)
  assert.match(map, /bias: 'proximity:' \+ center\.value\.longitude/)
  assert.match(map, /queryGeocoder\('search'/)
})
test('creation uses map only for VISIT and sends coordinates to CRM', () => {
  assert.match(calendar, /v-if="editor\.type === 'VISIT'"/)
  assert.match(calendar, /<CrmVisitMapPicker/)
  assert.match(calendar, /locationLatitude: data\.type === 'VISIT'/)
  assert.match(calendar, /locationLongitude: data\.type === 'VISIT'/)
})
test('complete activity editor persists coordinates while detail renders location', () => {
  assert.match(fullEditor, /updateVisitCoordinates: true/)
  assert.match(fullEditor, /<CrmVisitMapPicker/)
  assert.match(detail, /record\.locationLatitude != null/)
  assert.match(detail, /readonly/)
})
test('Geoapify is ready without configuration in environment files', () => {
  assert.doesNotMatch(read('Dockerfile'), /VITE_GEOAPIFY_API_KEY/)
  for (const path of ['.github/workflows/deploy-staging.yml','.github/workflows/deploy-production.yml'])
    assert.doesNotMatch(read(path), /VITE_GEOAPIFY_API_KEY/)
})
