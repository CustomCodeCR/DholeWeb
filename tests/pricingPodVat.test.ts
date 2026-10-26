import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolveDestinationVatRate, resolvePodCountryCode, resolvePodVatRate, stripGeneratedPodVatNotes } from '../src/modules/pricing/utils/pricingPodVat.ts'
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

test('Both pricing wizards offer the IVA checkbox on every rate line and recalculate it from POD', () => {
  for (const path of [
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /resolveDestinationVatRate\(resolvePodForDestination\(\), selectedDestination\.value, catalogs\.countries\)/)
    assert.match(source, /function lineDestinationTaxRate\(_line: RateLine\) \{\s*\/\/[^\n]*\n\s*return destinationTaxRate\.value/)
    assert.match(source, /IVA \$\{destinationTaxOrigin\}/)
    assert.equal((source.match(/class="crystal-line-vat"/g) ?? []).length, 2)
    assert.doesNotMatch(source, /v-if="canApplyDestinationTax\(line\)" class="crystal-line-vat"/)
  }
})
