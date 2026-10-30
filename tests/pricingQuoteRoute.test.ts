import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pricingQuoteRouteName } from '../src/modules/pricing/utils/pricingQuoteRoute.ts'

const polName = 'Ciudad de Panama, Panama'
const poeName = 'San Pedro Sula, Honduras'

test('FTL/LTL/air without POD display POE as destination, never To null Via POE', () => {
  for (const shipmentMode of ['Ftl', 'Ltl', 'Air', 'AirConsol'] as const) {
    const rate = { shipmentMode, polName, poeName, podName: null }
    assert.equal(
      pricingQuoteRouteName(rate),
      'Ciudad de Panama, Panama To San Pedro Sula, Honduras',
      shipmentMode,
    )
  }
})

test('historical missing POD strings are never written into route names', () => {
  for (const podName of [undefined, '', '   ', 'null', ' NULL ', 'undefined', 'N/A']) {
    assert.equal(
      pricingQuoteRouteName({ polName, poeName, podName }),
      'Ciudad de Panama, Panama To San Pedro Sula, Honduras',
    )
  }
})

test('maritime route with a true POD keeps the Via POE leg and existing port normalization', () => {
  assert.equal(
    pricingQuoteRouteName(
      { polName: 'Shanghai, China', poeName: 'Manzanillo, Panamá', podName: 'San José, Costa Rica' },
      (poe) => poe.includes('Manzanillo') ? 'Multimodal' : poe,
    ),
    'Shanghai, China To San José, Costa Rica Via Multimodal',
  )
})

test('missing destination never creates an empty Via or literal null', () => {
  assert.equal(pricingQuoteRouteName({ polName, poeName: '', podName: null }), polName)
})

test('the displayed rate name and PDF export share the same route formatter', () => {
  const format = readFileSync(new URL('../src/modules/pricing/utils/pricingFormat.ts', import.meta.url), 'utf8')
  assert.match(format, /import \{ pricingQuoteRouteName \} from/)
  assert.match(format, /const route = pricingQuoteRouteName\(rate, rateViaLabel\)/)
  assert.match(format, /const baseName = \`\$\{rate\.rateCode\} - Tarifa \$\{shipmentDescription\} - \$\{incoterm\} - \$\{route\}\`/)
})
