import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = path => readFileSync(path, 'utf8')
const settings = source('src/modules/settings/views/SettingsView.vue')
const account = source('src/modules/crm/components/CrmAccountHub.vue')
const prospect = source('src/modules/crm/views/CrmRecordDetailView.vue')
const workspace = source('src/modules/crm/views/CrmWorkspaceView.vue')
const calendar = source('src/modules/crm/components/CrmSalesCalendar.vue')

test('settings tiles remain one column and compact on small screens', () => {
  assert.match(settings, /data-settings-overview/)
  assert.match(settings, /grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2/)
  assert.match(settings, /settings-mobile-card/)
  assert.match(settings, /@media \(max-width: 639px\)/)
})

test('account and prospect tab rows scroll on phones without splitting labels', () => {
  for (const view of [account, prospect]) {
    assert.match(view, /flex-nowrap gap-2 overflow-x-auto overscroll-x-contain/)
    assert.match(view, /lg:sticky lg:flex-wrap lg:overflow-visible/)
    assert.match(view, /flex-shrink:0;align-items:center/)
    assert.match(view, /white-space:nowrap/)
    assert.match(view, /top:auto/)
    assert.match(view, /@media\(min-width:1024px\)/)
    assert.match(view, /role="tablist"/)
    assert.match(view, /aria-selected/)
  }
})

test('agenda navigation keeps names intact with swipeable tabs', () => {
  assert.match(workspace, /data-crm-agenda-view-tabs/)
  assert.match(workspace, /flex-nowrap gap-1 overflow-x-auto overscroll-x-contain/)
  assert.match(workspace, /shrink-0 whitespace-nowrap/)
  for (const label of ['Listado', 'Calendario', 'Bitácora · Notas', 'Reportes'])
    assert.ok(workspace.includes(label))
})

test('calendar uses list by default on phones and a scrollable seven-day month when selected', () => {
  assert.match(calendar, /window\.matchMedia\('\(max-width: 639px\)'\)/)
  assert.match(calendar, /mode\.value = 'list'/)
  assert.match(calendar, /data-crm-month-scroll/)
  assert.match(calendar, /min-w-\[700px\] sm:min-w-0/)
  assert.match(calendar, /grid-cols-4 gap-2 sm:flex/)
  assert.match(calendar, /relative z-10 flex min-w-0/)
  assert.match(calendar, /sm:sticky sm:top-\[112px\]/)
  assert.match(calendar, /aria-label="Período anterior"/)
  assert.match(calendar, /aria-label="Período siguiente"/)
})
