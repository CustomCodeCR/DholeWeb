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

test('wizard resolves CRM country IDs from the canonical countries group, retaining VAT-only entries', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const vat = readFileSync(new URL('../src/modules/pricing/utils/pricingPodVat.ts', import.meta.url), 'utf8')
  assert.match(wizard, /selectOptional\('countries'\)/)
  assert.match(wizard, /selectOptional\('country-vat-rates', 'country-tax-rates'\)/)
  assert.match(wizard, /countries: \[\.\.\.countries, \.\.\.countryVatRates\.filter/)
  assert.match(vat, /countryCatalogCode\(item\) === code && configuredVatRate\(item\) !== null/)
})

test('own LTL tariffs support explicit manual capture when no rate is returned', () => {
  const picker = readFileSync(new URL('../src/modules/pricing/components/PricingLtlRateSourceSelector.vue', import.meta.url), 'utf8')
  const transform = readFileSync(new URL('../build/pricingWizardLtlLclUiParity.ts', import.meta.url), 'utf8')
  assert.match(picker, /'manual-own': \[\]/)
  assert.match(picker, /@click="emit\('manual-own'\)"/)
  assert.match(transform, /@manual-own="continueManualOwnLandLtlTariff"/)
  assert.match(transform, /continueManualOwnLandLtlTariff\(\)/)
  assert.match(transform, /landLtlCommercialProfile\.value = 'FinalClient'/)
})

test('manual land LTL step 6 does not depend on a hidden carrier', () => {
  const finalValidation = readFileSync(new URL('../build/pricingRequiredFieldFinalFeedback.ts', import.meta.url), 'utf8')
  const carrierRequirement = readFileSync(new URL('../src/modules/pricing/utils/pricingCarrierRequirement.ts', import.meta.url), 'utf8')
  assert.match(finalValidation, /step\.value === 6 && form\.modality === 'Land'/)
  assert.match(finalValidation, /!manualColoaderNeedsAgent \|\| form\.agentId/)
  assert.match(finalValidation, /Number\.isFinite\(Number\(form\.freightCost\)\)/)
  assert.match(finalValidation, /Number\.isFinite\(Number\(form\.freightSale\)\)/)
  assert.match(finalValidation, /manualLandColoaderNeedsAgent\) && !form\.agentId/)
  assert.match(carrierRequirement, /\(modality === 'Maritime' \|\| modality === 'Multimodal'\)/)
})
