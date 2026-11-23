import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveDestinationVatRate, resolvePodCountryCode, resolvePodVatRate, resolvePricingLineVatContext, stripGeneratedPodVatNotes } from '../src/modules/pricing/utils/pricingPodVat.ts'
import type { CatalogItemSelectDto } from '../src/core/interfaces/catalogs'

function item(code: string, value: string, metadata: Record<string, unknown> = {}): CatalogItemSelectDto {
  return {
    id: code,
    code,
    slug: code.toLowerCase(),
    value,
    label: value,
    metadataJson: JSON.stringify(metadata),
    isActive: true,
  }
}

const countries = [
  item('CR', 'Costa Rica', { vatRate: 13 }),
  item('PA', 'Panamá', { vatRate: 7 }),
  item('GT', 'Guatemala', { vatRate: 15 }),
]

test('Uses the POD country even when the POE is in a different tax jurisdiction', () => {
  const poe = item('PAMIT', 'Manzanillo, Panamá', { countryCode: 'PA' })
  const pod = item('CRCAL', 'Caldera, Costa Rica', { countryCode: 'CR' })
  assert.equal(resolvePodVatRate(poe, countries), 7)
  assert.equal(resolvePodVatRate(pod, countries), 13)
  assert.equal(resolvePodCountryCode(pod, countries), 'CR')
})

test('Uses country metadata and handles a different final destination', () => {
  assert.equal(resolvePodVatRate(item('GTPRQ', 'Puerto Quetzal', { countryCode: 'GT' }), countries), 15)
  assert.equal(resolvePodVatRate(item('PABLB', 'Balboa', { countryCode: 'PA' }), countries), 7)
})

test('POD-specific VAT wins over the country default, including explicit zero', () => {
  assert.equal(resolvePodVatRate(item('CRSJO', 'San José', { countryCode: 'CR', vatRate: 8 }), countries), 8)
  assert.equal(resolvePodVatRate(item('CRLIM', 'Limón', { countryCode: 'CR', taxRate: 0 }), countries), 0)
})

test('A configured country VAT rate wins over the built-in fallback', () => {
  const modifiedCountries = [item('CR', 'Costa Rica', { vatRate: 11 }), ...countries.slice(1)]
  assert.equal(resolvePodVatRate(item('CRCAL', 'Caldera', { countryCode: 'CR' }), modifiedCountries), 11)
})

test('Can identify the POD country through countryId or name', () => {
  assert.equal(resolvePodCountryCode(item('DEST', 'Terminal final', { countryId: 'CR' }), countries), 'CR')
  assert.equal(resolvePodVatRate(item('DEST2', 'Puerto Guatemala'), countries), 15)
})

test('Resolves Vietnam from a full port label without depending on countries catalogue completeness', () => {
  const origin = item('POL-2026-029', 'Ho Chi Minh, Vietnam')
  const destination = item('POD-2026-012', 'San Jose, Costa Rica')
  assert.equal(resolvePodCountryCode(origin, countries), 'VN')
  assert.equal(resolvePodCountryCode(destination, countries), 'CR')
  assert.equal(resolvePodCountryCode(item('UNKNOWN', 'Ho Chi Minh'), countries), '')
})

test('Does not fall back to POE or stale VAT when the POD is absent or unknown', () => {
  assert.equal(resolvePodVatRate(null, countries), 0)
  assert.equal(resolvePodVatRate(item('UNKNOWN', 'Puerto sin país'), countries), 0)
})

test('POD takes precedence over a different POE, even when its VAT is explicitly zero', () => {
  const poe = item('PABLB', 'Balboa, Panamá', { countryCode: 'PA' })
  const pod = item('CRCAL', 'Caldera, Costa Rica', { countryCode: 'CR' })
  assert.equal(resolveDestinationVatRate(pod, poe, countries), 13)
  assert.equal(resolveDestinationVatRate(item('CRLIM', 'Limón', { countryCode: 'CR', vatRate: 0 }), poe, countries), 0)
  assert.equal(resolveDestinationVatRate(item('UNKNOWN', 'Puerto sin país'), poe, countries), 0)
})

test('POE determines IVA only when there is no POD', () => {
  const poe = item('PABLB', 'Balboa, Panamá', { countryCode: 'PA' })
  assert.equal(resolveDestinationVatRate(null, poe, countries), 7)
  assert.equal(resolveDestinationVatRate(undefined, item('CRCAL', 'Caldera', { countryCode: 'CR' }), countries), 13)
  assert.equal(resolveDestinationVatRate(null, null, countries), 0)
  assert.equal(resolveDestinationVatRate(null, item('UNKNOWN', 'Puerto sin país'), countries), 0)
})

test('Old POE VAT notes are replaced without losing legitimate charge comments', () => {
  const notes = 'Cargo manual agregado desde Pricing · IVA 7%: 3.50; venta total: 53.50 · IVA 13%: 6.50; venta total: 56.50'
  assert.equal(stripGeneratedPodVatNotes(notes), 'Cargo manual agregado desde Pricing')
  assert.equal(stripGeneratedPodVatNotes('Comentario original'), 'Comentario original')
})

test('Both pricing wizards calculate line IVA from POL or POE, never from global POD', () => {
  for (const path of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /resolvePricingLineVatContext\(line\.section, operation, selectedOrigin\.value, poe, catalogs\.countries\)/)
    assert.match(source, /function lineDestinationTaxRate\(/)
    assert.match(source, /lineVatLabel\(line\)/)
    assert.equal((source.match(/class="crystal-line-vat"/g) ?? []).length, 2)
    assert.equal((source.match(/:disabled="!canApplyDestinationTax\(line\)"/g) ?? []).length, 2)
    assert.doesNotMatch(source, /const destinationTaxRate = computed/)
    assert.match(source, /IVA aplicado según POL\/POE/)
  }
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(wizard, /const routeVatOperation = pricingQuoteOperationOverride\.value \|\| operationForClientCountry\(/)
  assert.match(wizard, /lineDestinationTaxRate\(line, targetPoe, routeVatOperation\)/)
})

test('China origin with an opaque Config port ID resolves ISO CN for import direction', () => {
  const origin = item('POL-2026-003', 'Shanghai, China')
  const originLocode = item('CNSHA', 'Shanghai')
  const invalidMeta = item('POL-2026-011', 'Ningbo, China', { countryCode: 'CHINA' })
  const destination = item('POD-2026-012', 'San José, Costa Rica')
  assert.equal(resolvePodCountryCode(origin, countries), 'CN')
  assert.equal(resolvePodCountryCode(originLocode, countries), 'CN')
  assert.equal(resolvePodCountryCode(invalidMeta, countries), 'CN')
  assert.equal(resolvePodCountryCode(destination, countries), 'CR')
  assert.equal(resolvePodCountryCode(item('POL-2026-999', 'Shanghai'), countries), '')
})


test('El Salvador country is resolved from an explicit POD country label without Config ISO', () => {
  const origin = item('POL-2026-003', 'Qingdao, China')
  const destination = item('POD-2026-014', 'San Salvador, El Salvador')
  assert.equal(resolvePodCountryCode(origin, []), 'CN')
  assert.equal(resolvePodCountryCode(destination, []), 'SV')
  assert.equal(resolvePodCountryCode(destination, [item('CAT-SV', 'El Salvador', { countryCode: 'SLV' })]), 'SV')
  assert.equal(resolvePodCountryCode(item('POD-UNKNOWN', 'San Salvador'), []), '')
  assert.equal(resolvePodCountryCode(item('POE-2026-001', 'Acajutla, El Salvador'), []), 'SV')
})


test('Origin and pickup always use POL; destination and delivery always use POE', () => {
  const pol = item('CRSJO', 'San José', { countryCode: 'CR' })
  const poe = item('PABLB', 'Balboa', { countryCode: 'PA' })
  for (const operation of ['Import', 'Export', 'TransitDomestic'] as const) {
    for (const section of ['pickup_origin', 'origin_charges'] as const) {
      assert.deepEqual(resolvePricingLineVatContext(section, operation, pol, poe, countries), {
        source: 'POL', countryCode: 'CR', rate: 13,
      })
    }
    for (const section of ['destination_charges', 'delivery_destination'] as const) {
      assert.deepEqual(resolvePricingLineVatContext(section, operation, pol, poe, countries), {
        source: 'POE', countryCode: 'PA', rate: 7,
      })
    }
  }
})

test('Freight respects import/export perspective and avoids assuming transit VAT', () => {
  const pol = item('CRSJO', 'San José', { countryCode: 'CR' })
  const poe = item('PABLB', 'Balboa', { countryCode: 'PA' })
  assert.equal(resolvePricingLineVatContext('international_freight', 'Export', pol, poe, countries).rate, 13)
  assert.equal(resolvePricingLineVatContext('international_freight', 'Import', pol, poe, countries).rate, 7)
  assert.deepEqual(resolvePricingLineVatContext('international_freight', 'TransitDomestic', pol, poe, countries), {
    source: null, countryCode: '', rate: 0,
  })
})

test('Multi-POE alternatives resolve different rates independently of POD', () => {
  const pol = item('CNSHA', 'Shanghai', { countryCode: 'CN' })
  const panama = item('PABLB', 'Balboa', { countryCode: 'PA' })
  const costaRica = item('CRCAL', 'Caldera', { countryCode: 'CR' })
  assert.equal(resolvePricingLineVatContext('destination_charges', 'Import', pol, panama, countries).rate, 7)
  assert.equal(resolvePricingLineVatContext('destination_charges', 'Import', pol, costaRica, countries).rate, 13)
  assert.equal(resolvePricingLineVatContext('origin_charges', 'Import', pol, costaRica, countries).rate, 0)
})

test('Explicit zero and unknown ports never create an invented tax', () => {
  const pol = item('CRLIM', 'Limón', { countryCode: 'CR', vatRate: 0 })
  const poe = item('POE-UNKNOWN', 'Puerto sin país')
  assert.equal(resolvePricingLineVatContext('pickup_origin', 'Export', pol, poe, countries).rate, 0)
  assert.equal(resolvePricingLineVatContext('destination_charges', 'Import', pol, poe, countries).rate, 0)
})

test('Editing a persisted quote uses the configured cost port role, not its name, before IVA calculation', () => {
  for (const path of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /const configuredCost = detail\.costId \? costs\.value\.find/)
    assert.match(source, /section: configuredCost \? sectionForCost\(configuredCost\) : sectionForDetail\(detail\.costDetailType, detail\.name\)/)
    assert.match(source, /return lineVatContext\(line, poe, operation\)\.rate/)
    assert.match(source, /destinationTaxRate:[\s\S]{0,160}\? lineDestinationTaxRate\(line\)/)
  }
})
