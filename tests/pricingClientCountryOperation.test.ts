import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveCrmCountryCode, operationForClientCountry } from '../src/modules/pricing/utils/pricingClientCountryOperation.ts'
import { incotermClientPaysMainTransport, incotermClientSections, normalizeIncotermCode } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

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

test('an explicitly supplied CRM ISO country does not require a Config UUID', () => {
  assert.equal(resolveCrmCountryCode('cr', []), 'CR')
  assert.equal(resolveCrmCountryCode('vn', []), 'VN')
  assert.equal(resolveCrmCountryCode('not-a-country', []), '')
})

test('the wizard lets users supply a missing CRM country before validating step three', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const step3 = wizard.indexOf('El cliente se selecciona desde cuentas o prospectos del CRM.')
  const step5 = wizard.indexOf('Pantalla 5</p>')
  assert.ok(step3 > 0 && step5 > step3)
  const screen3Markup = wizard.slice(step3, step5)
  assert.match(screen3Markup, /v-model="pricingQuoteCountryOverrideId"/)
  assert.match(screen3Markup, /label="País del cliente para esta cotización \*"/)
  assert.match(wizard, /step\.value = 3\s+toastStore\.warning\('País necesario para guardar'/)
})

test('CRM country picker renders from the reactive catalog without an optional setup binding', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const diagnostic = readFileSync(new URL('../scripts/diagnose-pricing-bundle.mjs', import.meta.url), 'utf8')
  // Vite's pricing transforms may remove source-only computed bindings, while Vue
  // still compiles template access as $setup.*. A missing binding previously
  // crashed the entire wizard on creation/restore.
  assert.doesNotMatch(wizard, /pricingQuoteCountryOptions/)
  assert.equal(wizard.split(':options="catalogs.countries.filter(country =>').length - 1, 2)
  assert.ok(wizard.includes('!catalogs.countries.some(country =>'))
  assert.match(diagnostic, /'pricingQuoteCountryOptions'/)
})

test('wizard and freight guard share the CRM-derived operation', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  const picker = readFileSync(new URL('../src/modules/pricing/components/PricingCrmClientSelect.vue', import.meta.url), 'utf8')
  assert.match(wizard, /crmClientCountryId\.value = client\?\.countryId \|\| ''/)
  assert.match(wizard, /operationForClientCountry\(/)
  assert.match(wizard, /resolveCrmCountryCode\(crmClientCountryId\.value, catalogs\.countries\)/)
  assert.match(wizard, /'clientCountry'/)
  assert.match(plugin, /const hasInternationalTransportService = computed\(/)
  assert.match(plugin, /selectedServices\.value\.some\(/)
  assert.doesNotMatch(plugin, /freightNotRequiredByIncoterm/)
  // Country determines import/export responsibility; selecting a paid
  // transportation service is an independent decision made by the user.
  assert.match(picker, /countryId\?: string \| null/)
})

test('wizard has no unbound country perspective helper after Vite transforms', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const diagnostic = readFileSync(new URL('../scripts/diagnose-pricing-bundle.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(wizard, /\b(?:resolveClientRouteOperation|routeOperation|clientCountryCode)\b/)
  assert.match(wizard, /const automaticOperationType = computed\(\(\) => operationForClientCountry\(/)
  assert.match(wizard, /pricingQuoteOperationOverride\.value \|\| automaticOperationType\.value/)
  assert.match(wizard, /const operationType = computed<RateOperationType>\(/)
  assert.match(wizard, /if \(form\.clientId && !direction\.value\)/)
  assert.match(wizard, /v-if="form\.clientId && form\.originId && \(form\.podId \|\| form\.destinationId\) && !direction"/)
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

test('manual own LTL is a valid source on steps 5 and 6, not only manual coloader', () => {
  const provider = readFileSync(new URL('../build/pricingWizardLtlProviderParity.ts', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const final = readFileSync(new URL('../build/pricingRequiredFieldFinalFeedback.ts', import.meta.url), 'utf8')
  assert.match(provider, /const manualLtl = form\.manualRate/)
  assert.match(provider, /landLtlCommercialProfile\.value === 'FinalClient'/)
  assert.match(provider, /resolvedFtlTariff\.value \|\| manualLtl/)
  assert.match(final, /const ltlSourceReady = shipmentModeForApi\.value !== 'Ltl'/)
  assert.match(wizard, /costAmount: number\(form\.freightCost\)/)
  assert.match(wizard, /saleAmount: number\(form\.freightSale\)/)
})

test('rate request resumes with CRM country, or allows explicit country for this quotation', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const requests = readFileSync(new URL('../build/pricingSellerRateRequests.ts', import.meta.url), 'utf8')
  const crm = readFileSync(new URL('../build/pricingCommercialIdentityFields.ts', import.meta.url), 'utf8')
  const drafts = readFileSync(new URL('../build/pricingWizardDraftAutosave.ts', import.meta.url), 'utf8')
  assert.match(requests, /async function hydrateRateRequest\(\)/)
  assert.match(crm, /if \(form\.clientId\) await refreshModificationCrmOwner\(\)/)
  assert.match(crm, /crmClientCountryId\.value = String\(client\.countryId/)
  assert.match(wizard, /pricingQuoteCountryOverrideId = ref\(''\)/)
  assert.match(wizard, /País del cliente para esta cotización/)
  assert.match(wizard, /step\.value = 3\s+toastStore\.warning\('País necesario para guardar'/)
  assert.match(drafts, /pricingQuoteCountryOverrideId: pricingQuoteCountryOverrideId\.value/)
  assert.match(drafts, /landLtlCommercialProfile: landLtlCommercialProfile\.value/)
})

test('reselecting the own manual LTL source retains previously entered freight amounts', () => {
  const plugin = readFileSync(new URL('../build/pricingWizardLtlLclUiParity.ts', import.meta.url), 'utf8')
  assert.match(plugin, /const preserve = form\.manualRate && landLtlCommercialProfile\.value === 'FinalClient'/)
  assert.match(plugin, /form\.freightCost = previousCost/)
  assert.match(plugin, /form\.freightSale = previousSale/)
  assert.match(plugin, /form\.transitDays = previousTransitDays/)
})

test('China to Costa Rica is an import from the Costa Rican client perspective for all ICC terms', () => {
  const operation = operationForClientCountry('CR', 'CN', 'CR')
  assert.equal(operation, 'Import')
  for (const [code, mainTransport] of [
    ['EXW', true], ['FCA', true], ['FAS', true], ['FOB', true],
    ['CFR', false], ['CIF', false], ['CPT', false], ['CIP', false],
    ['DAP', false], ['DPU', false], ['DDP', false],
  ] as const) {
    const normalized = normalizeIncotermCode('INC-2026-005', `${code} - Config Catalog`)
    assert.equal(normalized, code)
    assert.equal(incotermClientPaysMainTransport(operation!, normalized), mainTransport)
  }
  assert.deepEqual(incotermClientSections('Import', 'CIF'), ['destination_charges', 'delivery_destination'])
  assert.deepEqual(incotermClientSections('Export', 'CIF'),
    ['pickup_origin', 'origin_charges', 'international_freight'])
  assert.equal(normalizeIncotermCode('INC-2026-005', 'CIFRA Freight'), 'INC-2026-005')
  assert.equal(operationForClientCountry('CN', 'CN', 'CR'), 'Export')
})


test('the commercial direction has an explicit Import/Export fallback when Config is incomplete', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const drafts = readFileSync(new URL('../build/pricingWizardDraftAutosave.ts', import.meta.url), 'utf8')
  assert.match(wizard, /label="Operación comercial \(selección manual disponible\)"/)
  assert.match(wizard, /value: 'Import', label: 'Importación'/)
  assert.match(wizard, /value: 'Export', label: 'Exportación'/)
  assert.match(wizard, /pricingQuoteOperationOverride\.value = rate\.operationType \|\| ''/)
  assert.doesNotMatch(wizard, /No se puede determinar la perspectiva comercial/)
  assert.match(drafts, /pricingQuoteOperationOverride: pricingQuoteOperationOverride\.value/)
  assert.match(drafts, /draft\.pricingQuoteOperationOverride === 'Import'/)
})
test('CRM accepts legacy ISO-2 country metadata keys without guessing names', () => {
  const configured = [{ id: 'country-el-salvador', code: 'SLV', metadataJson: '{"countryIso2":"SV"}' }] as Parameters<typeof resolveCrmCountryCode>[1]
  assert.equal(resolveCrmCountryCode('country-el-salvador', configured), 'SV')
  assert.equal(resolveCrmCountryCode('unlisted-country', configured), '')
})
