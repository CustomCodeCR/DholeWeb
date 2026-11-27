import test from 'node:test'
import assert from 'node:assert/strict'
import { contactsForDivision, defaultDivisionContacts } from '../src/modules/operations/utils/accountDivisionContacts.ts'

const rows = [
  { id: 'general', divisionIds: [] },
  { id: 'purchasing', divisionIds: ['p'] },
  { id: 'export', divisionIds: ['e'] },
  { id: 'both', divisionIds: ['p', 'e'] },
]
test('division contacts include general contacts and exclude other divisions', () => {
  assert.deepEqual(contactsForDivision(rows, 'p').map(x => x.id), ['general', 'purchasing', 'both'])
  assert.deepEqual(contactsForDivision(rows, 'e').map(x => x.id), ['general', 'export', 'both'])
})
test('legacy accounts preserve defaults and new accounts avoid cross-division notifications', () => {
  assert.deepEqual(defaultDivisionContacts(rows, '', true).map(x => x.id), ['general'])
  assert.deepEqual(defaultDivisionContacts(rows, '', false).map(x => x.id), ['general', 'purchasing', 'export', 'both'])
  assert.deepEqual(defaultDivisionContacts(rows, 'p', true).map(x => x.id), ['general', 'purchasing', 'both'])
})
