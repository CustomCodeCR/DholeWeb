import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const creation = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const edition = readFileSync('src/modules/crm/components/CrmAccountEditor.vue', 'utf8')

test('account creation exposes optional contact and geographic address sections', () => {
  assert.match(creation, /Contactos \(opcional\)/)
  assert.match(creation, /Direcciones \(opcional\)/)
  assert.match(creation, /@click="addAccountContact"/)
  assert.match(creation, /@click="addAccountAddress"/)
  assert.match(creation, /optionalContacts\.value = \[\]/)
  assert.match(creation, /optionalAddresses\.value = \[\]/)
  assert.match(creation, /<CrmAddressLocationFields/)
})

test('new account submits linked data in same POST without forcing contacts or addresses', () => {
  assert.match(creation, /contacts: optionalContacts\.value\.map/)
  assert.match(creation, /addresses: optionalAddresses\.value\.map/)
  assert.match(creation, /countryId: contact\.countryId \|\| form\.countryId \|\| null/)
  assert.match(creation, /countryId: address\.countryId \|\| form\.countryId \|\| null/)
  assert.match(creation, /crmCreate<CrmRow>\(model\.value\.resource, body, pendingCreateKey\.value\)/)
  assert.match(creation, /optionalContacts\.value\.some/)
  assert.match(creation, /optionalAddresses\.value\.some/)
  assert.doesNotMatch(creation, /if \(!optionalContacts\.value\.length \|\| !optionalAddresses\.value\.length\)/)
})

test('account edit supports creating contacts without leaving the existing editor', () => {
  assert.match(edition, /@click="beginNewContact"/)
  assert.match(edition, /@click="saveContact">Crear contacto/)
  assert.match(edition, /crmPath\('accounts', String\(props\.account\.id\), 'contacts'\)/)
  assert.match(edition, /'POST', \{ \.\.\.payload, relationRole: 'CONTACT', isPrimary: false \}/)
  assert.match(edition, /relatedContacts\.value = previous/)
  assert.match(edition, /relatedSuccess\.value = previous \?/)
  assert.match(edition, /@click="beginNewAddress"/)
  assert.match(edition, /crmPath\('accounts', String\(props\.account\.id\), 'addresses'\)/)
})

test('optional creation is restricted to the established CRM scopes', () => {
  assert.match(creation, /can\('crm\.contact\.create'\)/)
  assert.match(creation, /can\('crm\.account\.update'\)/)
  assert.match(edition, /can\('crm\.contact\.create'\)/)
  assert.match(edition, /can\('crm\.account\.update'\)/)
})
