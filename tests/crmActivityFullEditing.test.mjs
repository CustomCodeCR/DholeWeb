import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const editor = readFileSync(new URL('../src/modules/crm/components/CrmActivityFullEditor.vue', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/modules/crm/views/CrmRecordDetailView.vue', import.meta.url), 'utf8')
const collaboration = readFileSync(new URL('../src/modules/crm/components/CrmActivityCollaboration.vue', import.meta.url), 'utf8')

test('activity record offers its complete editor to users with crm.activity.update', () => {
  assert.match(detail, /<CrmActivityFullEditor/)
  assert.match(detail, /:can-manage="can\('crm\.activity\.update'\)"/)
  assert.match(detail, /@saved="load"/)
  assert.match(editor, /data-crm-activity-full-editor/)
})

test('full editor saves existing minutes, agreements and pending followups atomically', () => {
  assert.match(editor, /crmPath\('activities', String\(props\.activity\.id\), 'details'\), 'PUT'/)
  assert.match(editor, /expectedVersion: Number\(props\.activity\.rowVersion/)
  assert.match(editor, /expectedVersion: note\.expectedVersion/)
  assert.match(editor, /expectedVersion: item\.expectedVersion/)
  assert.match(editor, /completed: item\.completed/)
  assert.match(editor, /remove: item\.remove/)
  assert.match(editor, /Editar actividad completa/)
  assert.match(editor, /Guardar actividad completa/)
})

test('edited notes are not silently deleted and archived commitments stay auditable', () => {
  assert.match(editor, /\.filter\(note => note\.id \|\| note\.noteText\.trim\(\)\)/)
  assert.match(editor, /item\.id \|\| !item\.remove/)
  assert.match(editor, /Restaurar pendiente/)
  assert.match(editor, /\[Historial de edición\]/)
  assert.match(collaboration, /startsWith\('\[Historial de edición\]'\)/)
})

test('after save activity and linked panels refresh with the new record version', () => {
  assert.match(detail, /:key="id \+ '-'/)
  assert.match(detail, /String\(record\.rowVersion \?\? 0\)/)
})

test('an unscheduled completed record edits as bitácora without appointment fields', () => {
  assert.match(editor, /const isBitacora = computed/)
  assert.match(editor, /!props\.activity\.scheduledStartAt/)
  assert.match(editor, /Editar bitácora comercial/)
  assert.match(editor, /<template v-if="!isBitacora">/)
  assert.match(editor, /scheduledStartAt: isBitacora\.value \? null/)
  assert.match(editor, /scheduledEndAt: isBitacora\.value \? null/)
  assert.match(editor, /Generar tareas desde acuerdos/)
  assert.match(editor, /tasksFromSavedAgreements/)
  assert.match(editor, /Guardar bitácora y tareas/)
})
