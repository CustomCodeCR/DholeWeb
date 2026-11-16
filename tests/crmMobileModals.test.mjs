import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const read = path => readFileSync(path, 'utf8')
const modal = read('src/shared/components/organisms/DhModal.vue')
const recovery = read('src/modules/crm/components/CrmDraftRecoveryModal.vue')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')

test('Dhole modal supports opaque surfaces without changing glass defaults', () => {
  assert.match(modal, /surface\?: 'glass' \| 'solid'/)
  assert.match(modal, /surface: 'glass'/)
  assert.match(modal, /:data-dh-modal-surface="surface"/)
  assert.match(modal, /surface === 'solid'/)
  assert.match(modal, /bg-\[var\(--dh-card-solid\)\]/)
  assert.match(modal, /priority \? 'z-\[110\] bg-black\/60'/)
  assert.match(modal, /flex items-center justify-center p-2 backdrop-blur-sm/)
})

test('modal header, content and footer stay legible inside a mobile viewport', () => {
  assert.match(modal, /max-h-\[calc\(100dvh-1rem\)\]/)
  assert.match(modal, /min-h-11 min-w-11/)
  assert.match(modal, /break-words text-sm font-bold/)
  assert.match(modal, /overflow-x-hidden overflow-y-auto overscroll-contain/)
  assert.match(modal, /shrink-0 border-t/)
})

test('draft recovery has the top opaque layer and compact action grid', () => {
  assert.match(recovery, /priority\s+surface="solid"/)
  assert.match(recovery, /data-crm-draft-recovery-actions/)
  assert.match(recovery, /grid-cols-2 gap-2 sm:flex/)
  for (const option of ['Más tarde', 'Descartar', 'Recuperar borrador'])
    assert.ok(recovery.includes(option))
  assert.match(recovery, /col-span-2 min-w-0 w-full sm:w-auto/)
})

test('activity creation remains functional with two mobile columns and sticky footer', () => {
  assert.match(calendar, /:open="creationOpen"[^>]*size="lg" surface="solid"/)
  assert.match(calendar, /data-crm-calendar-activity-mode/)
  assert.match(calendar, /calendar-mode-choice/)
  assert.match(calendar, /white-space:normal;overflow-wrap:anywhere/)
  assert.match(calendar, /data-crm-calendar-create-actions/)
  assert.match(calendar, /form="crm-agenda-create-form"/)
  assert.match(calendar, /@submit\.prevent="create"/)
  assert.match(calendar, /@click="setReminderMode\(false\)"/)
  assert.match(calendar, /@click="setReminderMode\(true\)"/)
})
