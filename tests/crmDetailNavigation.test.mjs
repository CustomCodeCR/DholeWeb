import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crmDetailReturnPath } from '../src/modules/crm/utils/crmDetailNavigation.ts'

test('activity detail returns to Agenda y seguimientos, not the old activities list', () => {
  assert.equal(crmDetailReturnPath('activities', undefined), '/crm/followups')
  assert.equal(crmDetailReturnPath('activities', ''), '/crm/followups')
})

test('returning from an account-linked activity preserves the original account', () => {
  const account = '11111111-1111-4111-8111-111111111111'
  assert.equal(crmDetailReturnPath('activities', account), '/crm/accounts/' + account)
  assert.equal(crmDetailReturnPath('followups', account), '/crm/accounts/' + account)
})

test('other CRM detail return paths remain unchanged', () => {
  assert.equal(crmDetailReturnPath('followups', undefined), '/crm/followups')
  assert.equal(crmDetailReturnPath('leads', undefined), '/crm/leads')
  assert.equal(crmDetailReturnPath('accounts', undefined), '/crm/accounts')
  assert.equal(crmDetailReturnPath('activities', 'invalid'), '/crm/followups')
})
