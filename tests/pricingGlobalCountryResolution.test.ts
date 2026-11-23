import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { CatalogItemSelectDto } from '../src/core/interfaces/catalogs'
import {
  normalizeIsoCountryCode,
  supportedIsoCountryCodes,
  resolveCatalogCountryCode,
  resolveExplicitCountryText,
  resolveLocationCountryCode,
} from '../src/modules/pricing/utils/pricingCountryIso.ts'
import { resolveCrmCountryCode, operationForClientCountry } from '../src/modules/pricing/utils/pricingClientCountryOperation.ts'
import { resolvePodCountryCode, resolvePodVatRate } from '../src/modules/pricing/utils/pricingPodVat.ts'

function item(code: string, value: string, metadata: Record<string, unknown> = {}): CatalogItemSelectDto {
  return {
    id: code,
    code,
    value,
    label: value,
    slug: code.toLowerCase(),
    metadataJson: JSON.stringify(metadata),
    isActive: true,
  }
}

test('ISO-3166 coverage is worldwide and excludes unknown codes', () => {
  assert.equal(supportedIsoCountryCodes().length, 249)
  for (const code of supportedIsoCountryCodes()) {
    assert.equal(normalizeIsoCountryCode(code), code)
    assert.equal(resolveLocationCountryCode(item(code + 'XYZ', 'Terminal sin país'), []), code)
  }
  assert.equal(normalizeIsoCountryCode('CHN'), 'CN')
  assert.equal(normalizeIsoCountryCode('SLV'), 'SV')
  assert.equal(normalizeIsoCountryCode('DEU'), 'DE')
  assert.equal(normalizeIsoCountryCode('ZAF'), 'ZA')
  assert.equal(normalizeIsoCountryCode('USA'), 'US')
  assert.equal(normalizeIsoCountryCode('BRA'), 'BR')
  assert.equal(normalizeIsoCountryCode('XXX'), '')
  assert.equal(normalizeIsoCountryCode('ZZ'), '')
  assert.equal(normalizeIsoCountryCode('POL-2026-003'), '')
})

test('worldwide POL/POE/POD routes resolve without a Config country catalog', () => {
  const cases: Array<[string, string, string]> = [
    ['CN', 'Qingdao, China', 'CNSHA'],
    ['SV', 'Acajutla, El Salvador', 'SVACA'],
    ['CR', 'San José, Costa Rica', 'CRSJO'],
    ['ES', 'Valencia, España', 'ESVLC'],
    ['DE', 'Hamburg, Germany', 'DEHAM'],
    ['NL', 'Rotterdam, Netherlands', 'NLRTM'],
    ['US', 'New York, United States', 'USNYC'],
    ['BR', 'Santos, Brasil', 'BRSSZ'],
    ['IN', 'Nhava Sheva, India', 'INNSA'],
    ['JP', 'Tokyo, Japón', 'JPTYO'],
    ['KR', 'Busan, South Korea', 'KRPUS'],
    ['VN', 'Ho Chi Minh, Viet Nam', 'VNSGN'],
    ['AE', 'Jebel Ali, Emiratos Árabes Unidos', 'AEJEA'],
    ['ZA', 'Durban, South Africa', 'ZADUR'],
    ['AU', 'Sydney, Australia', 'AUSYD'],
    ['NZ', 'Auckland, New Zealand', 'NZAKL'],
    ['FR', 'Marseille, France', 'FRMRS'],
    ['GB', 'London, United Kingdom', 'GBLON'],
    ['HK', 'Hong Kong', 'HKHKG'],
    ['SG', 'Singapore', 'SGSIN'],
    ['TR', 'Istanbul, Turkey', 'TRIST'],
    ['CI', 'Abidjan, Ivory Coast', 'CIABJ'],
    ['CD', 'Kinshasa, Democratic Republic of the Congo', 'CDFIH'],
    ['CG', 'Pointe Noire, Republic of the Congo', 'CGPNR'],
  ]
  for (const [iso, label, unlocode] of cases) {
    const legacy = item('POD-2026-099', label)
    assert.equal(resolveLocationCountryCode(legacy, []), iso, label)
    assert.equal(resolvePodCountryCode(legacy, []), iso, label)
    const codeOnly = item(unlocode, 'Unspecified terminal')
    assert.equal(resolveLocationCountryCode(codeOnly, []), iso, unlocode)
  }
})

test('supports Spanish English French and Portuguese localized country labels', () => {
  const cases: Array<[string, string]> = [
    ['México', 'MX'], ['Allemagne', 'DE'], ['Alemanha', 'DE'],
    ['United States of America', 'US'], ['Estados Unidos de América', 'US'],
    ['Corea del Sur', 'KR'], ['Korea, Republic of', 'KR'],
    ['República Checa', 'CZ'], ['Türkiye', 'TR'],
    ['Côte d’Ivoire', 'CI'], ['Costa de Marfil', 'CI'],
    ['Bolivia', 'BO'], ['Ecuador', 'EC'], ['Perú', 'PE'],
    ['República Dominicana', 'DO'], ['El Salvador', 'SV'],
  ]
  for (const [name, iso] of cases) {
    assert.equal(resolveExplicitCountryText(name, []), iso, name)
  }
})

test('uses a configured countryId, then canonical ISO in metadata, then country labels', () => {
  const countries = [
    item('COUNTRY-01', 'El Salvador', { iso3: 'SLV' }),
    item('COUNTRY-02', 'Japan', { countryIso2: 'JP' }),
    item('COUNTRY-03', 'República Dominicana', { countryCode: 'DOM' }),
  ]
  assert.equal(resolveCatalogCountryCode(countries[0]), 'SV')
  assert.equal(resolveCrmCountryCode('COUNTRY-03', countries), 'DO')
  assert.equal(resolveCrmCountryCode('COUNTRY-02', countries), 'JP')
  assert.equal(resolveLocationCountryCode(item('CUSTOM', 'Terminal sin país', { countryId: 'COUNTRY-01' }), countries), 'SV')
  assert.equal(resolveLocationCountryCode(item('CUSTOM', 'Terminal sin país', { countryIso3: 'JPN' }), countries), 'JP')
  assert.equal(resolveLocationCountryCode(item('CUSTOM', 'Terminal sin país', { country: 'México' }), countries), 'MX')
})

test('never classifies a port solely by a city name or an opaque Config identifier', () => {
  assert.equal(resolveLocationCountryCode(item('POL-2026-001', 'Shanghai'), []), '')
  assert.equal(resolveLocationCountryCode(item('POD-2026-002', 'San Salvador'), []), '')
  assert.equal(resolveLocationCountryCode(item('POD-2026-002', 'Rotterdam'), []), '')
  assert.equal(resolveExplicitCountryText('Congo', []), '')
  assert.equal(resolveLocationCountryCode(item('POD-2026-002', 'Desconocido'), []), '')
  assert.equal(resolveLocationCountryCode(item('DEST2', 'Desconocido'), []), '')
  assert.equal(resolveLocationCountryCode(item('DEST2', 'Puerto Guatemala'), []), 'GT')
  assert.equal(resolveLocationCountryCode(item('SDSAL', 'San Salvador, El Salvador'), []), 'SV')
  assert.equal(resolveLocationCountryCode(item('PORT2', 'Port of Spain'), []), '')
  assert.equal(resolveCrmCountryCode('unmapped-crm-uuid', []), '')
  assert.equal(operationForClientCountry('ZZ', 'CN', 'SV'), null)
  assert.equal(operationForClientCountry('SV', '', 'CN'), null)
})

test('route direction always reflects client versus actual endpoints', () => {
  for (const [origin, destination] of [
    ['CN', 'SV'], ['DE', 'CR'], ['ES', 'MX'], ['BR', 'US'],
    ['JP', 'AU'], ['ZA', 'NL'], ['VN', 'CA'], ['IN', 'AE'],
  ]) {
    assert.equal(operationForClientCountry(destination, origin, destination), 'Import')
    assert.equal(operationForClientCountry(origin, origin, destination), 'Export')
    assert.equal(operationForClientCountry('FR', origin, destination),
      'FR' === origin || 'FR' === destination ? null : 'TransitDomestic')
  }
})

test('VAT remains based on the physical POD and not the commercial direction', () => {
  const countries = [
    item('COUNTRY-CR', 'Costa Rica', { countryIso3: 'CRI', vatRate: 13 }),
    item('COUNTRY-GT', 'Guatemala', { countryIso3: 'GTM', vatRate: 15 }),
  ]
  const pod = item('POD-2026-001', 'San José, Costa Rica')
  assert.equal(resolvePodVatRate(pod, countries), 13)
  assert.equal(resolvePodVatRate(item('POD-2026-002', 'Puerto Quetzal, Guatemala'), countries), 15)
})

test('Pricing has an explicit manual override when an unknown route cannot be identified safely', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  // The third call resolves the commercial direction for each multi-POE alternative.
  assert.equal((wizard.match(/pricingQuoteOperationOverride\.value \|\| operationForClientCountry\(/g) ?? []).length, 3)
  assert.doesNotMatch(wizard, /automaticOperationType/)
  assert.match(wizard, /label="Importación/)
  assert.match(wizard, /showCommercialOperationControls/)
  assert.match(wizard, /Cambiar operación/)
  assert.match(wizard, /label="Operación comercial de la solicitud"/)
  assert.doesNotMatch(wizard, /No se puede determinar la perspectiva comercial/)
})
