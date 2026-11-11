import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const editor = readFileSync('src/modules/crm/components/CrmAccountEditor.vue', 'utf8')
const leadDetail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')

const categoryScope = 'crm.account.category.manage'

test('new clients are assigned the conservative default category without the scope', () => {
  assert.match(workspace, /function accountCategoryDefault\(type: unknown\)/)
  assert.match(workspace, /if \(!can\('crm\.account\.category\.manage'\)\) form\.categoryCode = accountCategoryDefault/)
  assert.match(workspace, /body\.categoryCode = accountCategoryDefault\(form\.categoryType\)/)
})

test('create and edit category selectors are disabled without category scope', () => {
  assert.match(workspace, /:disabled="!!edited \|\| !can\('crm\.account\.category\.manage'\)"/)
  assert.match(editor, /<DhSelect label="Categoría" :disabled="!can\('crm\.account\.category\.manage'\)"/)
  assert.match(editor, /<DhSelect label="Tipo de cuenta" :disabled="!can\('crm\.account\.category\.manage'\)"/)
})

test('lead conversion cannot select category without the scope', () => {
  assert.match(leadDetail, /<DhSelect label="Categoría" :disabled="!can\('crm\.account\.category\.manage'\)"/)
  assert.match(leadDetail, /categoryCode: can\('crm\.account\.category\.manage'\)/)
})
