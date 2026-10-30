import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callingCodes, dialCodeForCountry, internationalPhone, localPhonePart } from '../src/modules/crm/utils/crmPhone.ts'

const country = (code: string, name: string, metadataJson: string | null = null) =>
  ({ code, name, slug: name.toLowerCase(), value: code, metadataJson })

test('Country phone prefixes cover Costa Rica and nearby logistics markets', () => {
  assert.equal(dialCodeForCountry(country('CRI', 'Costa Rica')), '+506')
  assert.equal(dialCodeForCountry(country('PA', 'Panamá')), '+507')
  assert.equal(dialCodeForCountry(country('SLV', 'El Salvador')), '+503')
  assert.equal(dialCodeForCountry(country('GTM', 'Guatemala')), '+502')
  assert.equal(dialCodeForCountry(country('HND', 'Honduras')), '+504')
  assert.equal(dialCodeForCountry(country('NIC', 'Nicaragua')), '+505')
  assert.equal(dialCodeForCountry(country('USA', 'Estados Unidos')), '+1')
  assert.equal(dialCodeForCountry(country('ESP', 'España')), '+34')
  assert.ok(callingCodes.size >= 240)
})
test('Config dialing metadata overrides ISO fallback', () => {
  assert.equal(dialCodeForCountry(country('CRI', 'Costa Rica', '{"callingCode":"+599"}')), '+599')
  assert.equal(dialCodeForCountry(country('UNKNOWN', 'Otro', '{"phoneCode":"503"}')), '+503')
  assert.equal(dialCodeForCountry(country('UNKNOWN', 'Otro', '{"phoneCode":"garbage"}')), null)
})
test('Phone input stores national digits with prefix without double prefix', () => {
  assert.equal(internationalPhone('+506', '8313 0794'), '+50683130794')
  assert.equal(localPhonePart('+50683130794', '+506'), '83130794')
  assert.equal(internationalPhone('+506', localPhonePart('+50683130794', '+506')), '+50683130794')
  assert.equal(internationalPhone('+507', localPhonePart('+50683130794', '+506')), '+50783130794')
  assert.equal(internationalPhone('+506', '+34 612 34 56 78'), '+34612345678')
  assert.equal(internationalPhone('+506', ''), '')
  assert.equal(internationalPhone(null, '83130794'), '83130794')
})
