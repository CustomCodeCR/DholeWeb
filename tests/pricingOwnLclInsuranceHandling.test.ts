import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const own = readFileSync(new URL('../build/pricingWizardOwnLclLinePersistence.ts', import.meta.url), 'utf8')
const hydrate = readFileSync(new URL('../build/pricingWizardPersistedLclHydration.ts', import.meta.url), 'utf8')
const refresh = readFileSync(new URL('../build/pricingWizardScreen7CostChoice.ts', import.meta.url), 'utf8')
test('own LCL invoice preserves insurance and historical Manejos across editing and saving', () => {
  assert.match(own, /function ownLclKeepQuotedLine/)
  assert.match(own, /name\.includes\('seguro'\)/)
  assert.match(own, /name\.startsWith\('manejos'\)/)
  assert.match(own, /ownLclKeepQuotedLine\(detail, editingRate\.value!\.rateDetails\)/)
  assert.match(own, /ownLclKeepQuotedLine\(line, \$\{detailsMapperAnchor\}\)/)
  assert.match(own, /ownLclTransientSupplementalLines\(\)/)
  assert.doesNotMatch(own, /Los LCL propios se calculan exclusivamente desde sus líneas guardadas/)
})
test('loading and confirmed refresh never drop independently billed insurance', () => {
  assert.match(hydrate, /ownLclKeepQuotedLine\(line, rateLines\.value\)/)
  assert.match(refresh, /ownLclKeepQuotedLine\(line, \[\.\.\.fresh, \.\.\.previous\]\)/)
})
