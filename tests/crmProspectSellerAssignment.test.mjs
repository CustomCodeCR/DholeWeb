import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const picker = readFileSync('src/modules/crm/components/CrmExecutivePicker.vue', 'utf8')

test('prospect list resolves assigned seller names through scoped CRM endpoint', () => {
  assert.match(workspace, /Vendedor asignado/)
  assert.match(workspace, /loadLeadSellers\(response.items\)/)
  assert.match(workspace, /crmPath\('leads', 'assigned-executives'\)/)
})
test('admin can assign new and existing prospects to sellers', () => {
  assert.match(workspace, /can\('crm.lead.assign'\)/)
  assert.doesNotMatch(workspace, /:allow-institutional="false"/)
  assert.match(workspace, /\['accounts', 'leads'\].includes\(section.value\)/)
  assert.match(workspace, /body.assignToCastroFallas = true/)
  assert.match(detail, /crmPath\('leads', id.value, 'assign'\)/)
  assert.match(detail, /leadExecutiveName/)
})
test('Castro Fallas appears for creation and reassignment without Auth sentinel UUID', () => {
  assert.match(picker, /props.allowInstitutional !== false/)
  assert.match(picker, /CASTRO_FALLAS_SELLER = '__castro_fallas__'/)
  assert.doesNotMatch(detail, /:allow-institutional="section === 'accounts'"/)
  assert.match(detail, /assignToCastroFallas: selectedExecutive.value === '__castro_fallas__'/)
  assert.match(detail, /executiveUserId: selectedExecutive.value === '__castro_fallas__' \? null/)
})

test('Castro Fallas is visible in accounts and prospects by default and pinned above Auth sellers', () => {
  assert.match(picker, /withDefaults\(defineProps<\{ modelValue: string; label\?: string; allowInstitutional\?: boolean \}>\(\),\s*\{\s*allowInstitutional: true/)
  assert.match(picker, /const showHouseSeller = computed\(\(\) => props\.allowInstitutional\)/)
  assert.match(workspace, /label="Ejecutivo de ventas" :allow-institutional="true"/)
  assert.match(workspace, /label="Asignar prospecto a un vendedor" :allow-institutional="true"/)
  assert.match(detail, /label="Ejecutivo" :allow-institutional="true"/)
  const house = picker.indexOf('<label v-if="showHouseSeller"')
  const scrollingUsers = picker.indexOf('data-crm-auth-sellers')
  assert.ok(house > 0 && scrollingUsers > house, 'Castro Fallas must be outside the scrolling list')
  assert.match(picker, /@change="emit\('update:modelValue', CASTRO_FALLAS_SELLER\)"/)
})
