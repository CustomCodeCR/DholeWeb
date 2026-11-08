import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  splitPricingCommercialTermLines,
  expandPricingCommercialCatalogItems,
} from '../src/modules/pricing/utils/pricingCommercialTermLines.ts'

test('one saved includes blob with literal escaped newlines becomes independent items', () => {
  const persisted = 'Flete internacional marítimo\\nManejos\\nHBL\\nCargos en destino\\nInland Caldera a GAM'
  assert.deepEqual(splitPricingCommercialTermLines([persisted]), [
    'Flete internacional marítimo', 'Manejos', 'HBL',
    'Cargos en destino', 'Inland Caldera a GAM',
  ])
})

test('real newlines, CRLF, backslash-r-n and twice-escaped newlines normalize identically', () => {
  assert.deepEqual(
    splitPricingCommercialTermLines([
      'Flete internacional marítimo\nManejos',
      'HBL\r\nCargos en destino',
      'Inland\\r\\nRelease',
      'Gastos\\\\nTHC',
      'Carta de transbordo\rPase VIP',
    ]),
    [
      'Flete internacional marítimo', 'Manejos', 'HBL', 'Cargos en destino',
      'Inland', 'Release', 'Gastos', 'THC', 'Carta de transbordo', 'Pase VIP',
    ],
  )
})

test('old comma-separated lists stay readable without splitting decimal money', () => {
  assert.deepEqual(
    splitPricingCommercialTermLines(['Manejos, HBL, Marchamo USD 100,50 + IVA']),
    ['Manejos', 'HBL', 'Marchamo USD 100,50 + IVA'],
  )
})

test('repeated terms ignore accents/case while preserving commercial text', () => {
  assert.deepEqual(
    splitPricingCommercialTermLines(['Trámites de aduana\\nHBL', 'tramites de aduana', 'hbl']),
    ['Trámites de aduana', 'HBL'],
  )
})

test('a malformed catalog item yields stable, separately draggable terms and prefers active items', () => {
  const catalog = [
    { id: 'legacy', text: 'Flete internacional\\nHBL\\nManejos', sortOrder: 10, isActive: false },
    { id: 'canonical-hbl', text: 'HBL', sortOrder: 1, isActive: true },
  ]
  const expanded = expandPricingCommercialCatalogItems(catalog)
  assert.deepEqual(expanded.map((entry) => entry.text), ['Flete internacional', 'HBL', 'Manejos'])
  assert.equal(expanded[0]?.id, 'legacy')
  assert.equal(expanded[1]?.id, 'canonical-hbl')
  assert.equal(expanded[2]?.id, 'legacy:legacy-term:2')
  assert.equal(expanded[1]?.isActive, true)
})

test('selector, drag board and compiled wizard share separated items without data migrations', () => {
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingCommercialTermsSelector.vue', import.meta.url), 'utf8')
  const wizard = readFileSync(new URL('../build/pricingWizardEnhancements.ts', import.meta.url), 'utf8')
  assert.match(selector, /catalogItems\.value = expandPricingCommercialCatalogItems/)
  assert.match(selector, /return splitPricingCommercialTermLines\(values\)/)
  assert.match(selector, /includes: filterTransportOnlyTerms\(texts\('Includes'\)/)
  assert.match(wizard, /return splitPricingCommercialTermLines\(values\)/)
  assert.match(wizard, /draftCommercialTermsInitialized\.value/)
  assert.match(wizard, /draftCommercialTerms\.value\.includes/)
})
