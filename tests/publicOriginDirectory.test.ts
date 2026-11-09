import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canUsePublicDirectoryFallback,
  findPublicDirectoryOffice,
  getPublicColoaderContacts,
} from '../src/modules/pricing/utils/publicOriginDirectory.ts'

test('Shanghai coloader uses the two verified Grupo Castro Fallas mailboxes', () => {
  const contacts = getPublicColoaderContacts('Shanghai, China')
  assert.equal(contacts.length, 2)
  assert.equal(contacts[0]?.email, 'china@grupocastrofallas.com')
  assert.equal(contacts[1]?.email, 'consolidado-china@grupocastrofallas.com')
  assert.ok(contacts.every((c) => c.email.endsWith('@grupocastrofallas.com')))
  assert.equal(contacts.some((c) => c.email.includes('castrofallas.com') && !c.email.includes('grupocastrofallas.com')), false)
})

test('A257 and A287 retain their separate official addresses', () => {
  assert.match(findPublicDirectoryOffice('A257')?.address ?? '', /Café Volio/)
  assert.match(findPublicDirectoryOffice('A287')?.address ?? '', /Hotel El Edén/)
  assert.equal(findPublicDirectoryOffice('Costa Rica'), null)
  assert.equal(findPublicDirectoryOffice('San José, Costa Rica'), null)
})

test('Panama and Costa Rica keep their listed operational mailbox and schedule', () => {
  const panama = findPublicDirectoryOffice('Panamá, Panamá')
  assert.equal(panama?.contacts[0]?.email, 'panama@grupocastrofallas.com')
  assert.equal(panama?.schedule, '08:00 - 16:00')
  const costaRica = findPublicDirectoryOffice('A257 Curridabat, Costa Rica')
  assert.equal(costaRica?.contacts[0]?.email, 'costarica@grupocastrofallas.com')
})

test('never replace a WWL-specific warehouse with generic RS China directory', () => {
  assert.equal(canUsePublicDirectoryFallback('Shanghai, China', 'WWL', ''), false)
  assert.equal(canUsePublicDirectoryFallback('Shanghai, China', 'RS', ''), false)
  // Shanghai has no row in the attached directory. Keep the real Config office.
  assert.equal(findPublicDirectoryOffice('Shanghai, China'), null)
})

test('regional coloader contact emails come only from verified company domain', () => {
  for (const [origin, address] of [
    ['Barcelona, España', 'espana@grupocastrofallas.com'],
    ['Miami, USA', 'estadosunidos@grupocastrofallas.com'],
    ['Panamá, Panamá', 'panama@grupocastrofallas.com'],
    ['A287 Tibás, Costa Rica', 'costarica@grupocastrofallas.com'],
  ]) {
    const contacts = getPublicColoaderContacts(origin)
    assert.deepEqual(contacts.map(c => c.email), [address, address])
  }
})

test('unknown origin never invents a contact email', () => {
  assert.deepEqual(getPublicColoaderContacts('Mars Port').map(c => c.email), ['', ''])
})
