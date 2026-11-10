import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')

test('account search advertises all three identity fields', () => {
  assert.match(workspace, /Buscar por nombre, razón social o cédula/)
  assert.match(workspace, /Buscar cuentas por nombre, razón social o cédula/)
})

test('account search goes to the server before pagination and account filters', () => {
  assert.match(workspace, /page: page\.value, pageSize: pageSize\.value, q: search\.value\.trim\(\)/)
  assert.match(workspace, /@keyup\.enter="page=1;load\(\)"/)
  assert.match(workspace, /@click="page=1;load\(\)"/)
  assert.match(workspace, /accountSellerFilter\.value\.join\(','\)/)
})
