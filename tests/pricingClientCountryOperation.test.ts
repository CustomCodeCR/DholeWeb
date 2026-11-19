import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveCrmCountryCode, operationForClientCountry } from '../src/modules/pricing/utils/pricingClientCountryOperation.ts'
import { incotermClientPaysMainTransport } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

test('client located in Honduras sees a Costa Rica to Honduras route as an import', () => {
  assert.equal(operationForClientCountry('HN', 'CR', 'HN'), 'Import')
  assert.equal(incotermClientPaysMainTransport('Import', 'CIF'), false)
  assert.equal(incotermClientPaysMainTransport('Import', 'EXW'), true)
})

test('client located in Costa Rica sees the same route as an export', () => {
  assert.equal(operationForClientCountry('CR', 'CR', 'HN'), 'Export')
  assert.equal(incotermClientPaysMainTransport('Export', 'DDP'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'FOB'), false)
})

test('third-country client and local routes use hybrid transit/domestic', () => {
  assert.equal(operationForClientCountry('PA', 'CR', 'HN'), 'TransitDomestic')
  assert.equal(operationForClientCountry('CR', 'CR', 'CR'), 'TransitDomestic')
  assert.equal(operationForClientCountry('HN', 'CN', 'CR'), 'TransitDomestic')
  assert.equal(operationForClientCountry('CR', 'CN', 'CR'), 'Import')
})

test('unresolved countries are not assumed to be Costa Rica or a freight direction', () => {
  assert.equal(operationForClientCountry('', 'CR', 'HN'), null)
  assert.equal(operationForClientCountry('HN', '', 'HN'), null)
  assert.equal(operationForClientCountry('HN', 'CR', ''), null)
  assert.equal(resolveCrmCountryCode('missing', []), '')
})

test('CRM country UUID resolves against Config country metadata', () => {
  const countries = [
    { id: 'hn-uuid', code: 'HN', value: 'Honduras', metadataJson: '{}' },
    { id: 'cr-uuid', code: '', value: 'Costa Rica', metadataJson: '{"countryCode":"CR"}' },
  ] as Parameters<typeof resolveCrmCountryCode>[1]
  assert.equal(resolveCrmCountryCode('HN-UUID', countries), 'HN')
  assert.equal(resolveCrmCountryCode('cr-uuid', countries), 'CR')
})

test('wizard and freight guard share the CRM-derived operation', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  const picker = readFileSync(new URL('../src/modules/pricing/components/PricingCrmClientSelect.vue', import.meta.url), 'utf8')
  assert.match(wizard, /crmClientCountryId\.value = client\?\.countryId \|\| ''/)
  assert.match(wizard, /operationForClientCountry\(/)
  assert.match(wizard, /resolveCrmCountryCode\(crmClientCountryId\.value, catalogs\.countries\)/)
  assert.match(wizard, /'clientCountry'/)
  assert.match(plugin, /operationForClientCountry\(/)
  assert.match(plugin, /if \(!perspective\) return false/)
  assert.match(picker, /countryId\?: string \| null/)
})

test('wizard has no unbound country perspective helper after Vite transforms', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const diagnostic = readFileSync(new URL('../scripts/diagnose-pricing-bundle.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(wizard, /\b(?:resolveClientRouteOperation|routeOperation|clientCountryCode)\b/)
  assert.match(wizard, /const perspective = operationForClientCountry\(/)
  assert.match(wizard, /const operationType = computed<RateOperationType>\(\(\) => operationForClientCountry\(/)
  assert.match(wizard, /if \(form\.clientId && !direction\.value\)/)
  assert.match(wizard, /v-if="form\.clientId && !direction"/)
  assert.match(diagnostic, /Unresolved Pricing wizard runtime binding/)
})
