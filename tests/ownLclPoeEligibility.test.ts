import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isBalboaOwnLclPoe, isMiamiOwnLclPol, isMoinOwnLclPoe, isOwnLclPoeEligible } from '../src/modules/pricing/utils/ownLclPoeEligibility.ts'

test('consolidado LCL propio disponible solamente para POE Balboa (POD independiente)', () => {
  for (const [code, name] of [
    ['PABLB', 'Balboa, Panamá'],
    ['PA-BLB', 'Balboa, Panama'],
    ['BLB', null],
    ['POE-2026-01', 'Puerto de Balboa, Panamá'],
    [null, 'Port of Balboa, Panama'],
  ] as const) {
    assert.equal(isBalboaOwnLclPoe(code, name), true)
  }

  for (const [code, name] of [
    ['CRCAL', 'Puerto Caldera, Costa Rica'],
    [null, 'San José, Costa Rica'],
    ['PAMIT', 'Manzanillo, Panamá'],
    [null, 'Puerto Caldera vía Balboa'],
    [null, null],
  ] as const) {
    assert.equal(isBalboaOwnLclPoe(code, name), false)
  }
})

test('wizard entrega el POE y selector oculta y bloquea propio fuera de Balboa', () => {
  const wizard = readFileSync(new URL('../build/pricingWizardEnhancements.ts', import.meta.url), 'utf8')
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
  assert.ok(wizard.includes(':poe-code="selectedDestination?.code ?? null"'))
  assert.ok(wizard.includes(':poe-name="displayValue(selectedDestination)"'))
  assert.ok(selector.includes('if (!ownPoeEligible.value) return []'))
  assert.ok(selector.includes('!ownPoeEligible.value ? Promise.resolve([] as OwnLclConsolidationDto[])'))
  assert.ok(selector.includes('if (!ownPoeEligible.value || !ownConsolidationSupportsPoe(row)'))
  assert.ok(selector.includes('<button v-if="ownPoeEligible"'))
})

test('Miami se identifica aunque el catálogo devuelva un nombre con país o código interno', () => {
  assert.equal(isMiamiOwnLclPol('USMIA', null), true)
  assert.equal(isMiamiOwnLclPol('POL-2026-001', 'Miami, Estados Unidos'), true)
  assert.equal(isMiamiOwnLclPol(null, 'Puerto de Miami, EE. UU.'), true)
  assert.equal(isMiamiOwnLclPol('CNSHA', 'Shanghai, China'), false)
})

test('Moín acepta los dos nombres del catálogo sin admitir puertos distintos', () => {
  for (const [code, name] of [
    ['POE-2026-1', 'Limón/Moín, Costa Rica'],
    ['POE-2026-2', 'Puerto Moin, Costa Rica'],
    [null, 'Puerto de Moín, Costa Rica'],
    ['PUERTO_MOIN', null],
  ] as const) {
    assert.equal(isMoinOwnLclPoe(code, name), true)
    assert.equal(isOwnLclPoeEligible('POL-2026-001', 'Miami, Estados Unidos', code, name), true)
  }
  for (const name of ['Puerto Caldera, Costa Rica', 'Balboa, Panamá', 'San José, Costa Rica']) {
    assert.equal(isOwnLclPoeEligible('MIA', 'Miami, Estados Unidos', null, name), false)
  }
  assert.equal(isOwnLclPoeEligible('CNSHA', 'Shanghai, China', 'PABLB', 'Balboa, Panamá'), true)
  assert.equal(isOwnLclPoeEligible('CNSHA', 'Shanghai, China', null, 'Puerto Moín, Costa Rica'), false)
  assert.equal(isOwnLclPoeEligible('MIA', 'Miami', 'PABLB', 'Balboa, Panamá'), false)
})

test('selector separa la ruta Miami/Moín de la ruta China/Balboa', () => {
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
  const previewPlugin = readFileSync(new URL('../build/pricingLclCostBreakdownUi.ts', import.meta.url), 'utf8')
  assert.ok(selector.includes('isOwnLclPoeEligible(props.polCode, props.polName, props.poeCode, props.poeName)'))
  assert.ok(selector.includes('if (isMiamiOwnLclPol(row.polCode, row.polName))'))
  assert.ok(selector.includes('&& isMoinOwnLclPoe(props.poeCode, props.poeName)'))
  assert.ok(selector.includes('if (!isBalboaOwnLclPoe(props.poeCode, props.poeName)) return false'))
  assert.ok(previewPlugin.includes("isMiamiOwnLclRow(row) ? (props.poeName || 'Puerto Moín, Costa Rica')"))
})
