import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const report = read('src/modules/crm/components/CrmActivityReports.vue')
const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')

test('CRM agenda exposes consolidated seller reporting', () => {
  assert.match(workspace, /CrmActivityReports/)
  assert.match(workspace, /agendaView==='reports'/)
  assert.match(report, /activities\/report/)
  assert.match(report, /ownerId/)
  assert.match(report, /allSellers/)
  assert.match(report, /from.*to/)
})

test('report exports the complete API result and retains unscheduled notes', () => {
  assert.match(report, /data\.items\.map\(/)
  assert.match(report, /downloadExcelWorkbook/)
  assert.match(report, /printPdf/)
  assert.match(report, /Actividades y bitácora/)
  assert.match(report, /calendar\/labels/)
})
