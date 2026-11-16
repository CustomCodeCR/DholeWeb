import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const picker = source('src/modules/pricing/components/PricingCrmClientSelect.vue')
const wizard = source('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

test('editing an existing QUO restores its CRM account or prospect by persisted ID', () => {
  assert.match(wizard, /form\.clientId = rate\.clientAccountId \?\? rate\.clientLeadId \?\? ''/)
  assert.match(wizard, /form\.crmClientKind = rate\.clientLeadId \? 'lead' : rate\.clientAccountId \? 'account' : ''/)
  assert.match(wizard, /:initial-name="form\.clientName"/)
  assert.match(picker, /selectedClientId: id/)
  assert.match(picker, /props\.modelValue !== id/)
  assert.match(picker, /emit\('selected', client\)/)
})

test('an unlinked historical QUO shows its saved name without silently selecting another CRM record', () => {
  assert.match(picker, /query\.value = props\.initialName/)
  assert.match(picker, /if \(!id\) \{\s*current\.value = null\s*query\.value = props\.initialName\s*return/)
  assert.match(picker, /else if \(!id && !current\.value\) query\.value = label/)
  assert.match(picker, /v-if="!modelValue && initialName\.trim\(\)"/)
  assert.match(picker, /Seleccione una cuenta o prospecto para vincularla/)
  assert.doesNotMatch(picker, /if \(!id\) \{\s*current\.value = null\s*query\.value = ''/)
})

test('explicit CRM selection remains authoritative for both client and executive', () => {
  assert.match(picker, /emit\('update:modelValue',client\.id\)/)
  assert.match(picker, /emit\('selected',client\)/)
  assert.match(wizard, /form\.crmClientKind = client\?\.kind \|\| ''/)
  assert.match(wizard, /form\.clientId = client\?\.id \|\| ''/)
})
