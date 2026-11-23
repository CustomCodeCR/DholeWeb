import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = source('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const summary = source('src/modules/pricing/views/PricingRateRequestResumeView.vue')

test('Seller modality and shipment comparisons include verified missing header differences', () => {
  assert.match(summary, /const originalRateHeader = ref/)
  assert.match(summary, /rate\.revisionNumber === original/)
  assert.match(summary, /const headerFields = \[/)
  assert.match(summary, /field: 'Modalidad', key: 'modality'/)
  assert.match(summary, /field: 'Tipo de embarque', key: 'shipmentMode'/)
  assert.match(summary, /normalizedHeader\(before\) === normalizedHeader\(after\)/)
  assert.match(summary, /return \[\.\.\.missing, \.\.\.visible\]/)
})

test('Editing preserves every persisted cost ID regardless of cargo condition', () => {
  assert.match(wizard, /rateLines\.value = rate\.rateDetails\.map\(\(detail\) => \{/)
  assert.doesNotMatch(wizard, /rateLines\.value = rate\.rateDetails\.filter\(\(detail\)/)
  assert.match(wizard, /props\.rateId && line\.detailId\s*\? line\.included/)
  assert.match(wizard, /function quotedConditionMatches\(line: RateLine\)/)
  assert.match(wizard, /quotedConditionMatches\(line\)/)
  assert.match(wizard, /if \(!editingRate\.value\) rateLines\.value = removeDuplicateFclFreight/)
})

test('Update payload pairs each cost with the exact persisted ID in its sorted order', () => {
  assert.match(wizard, /const normalizedIncludedLines = orderedCompleteRateLines\.value\.map/)
  assert.match(wizard, /const extraDetails = createPayload\.details\.map/)
  assert.match(wizard, /id: orderedCompleteRateLines\.value\[index\]\?\.detailId \?\? null/)
  assert.match(wizard, /const missingPersistedDetailIds = \[\.\.\.originalDetailIds\]/)
  assert.match(wizard, /missingPersistedDetails\s*\.map\(\(detail\) => detail\.name\)/)
  assert.match(wizard, /const removedExtraDetailIds: string\[\] = \[\]/)
  assert.match(wizard, /expectedRevisionNumber: editingRate\.value\.revisionNumber/)
})

test('Customs-only build transform retains persisted freight while excluding uncontracted new freight', () => {
  const customs = source('build/pricingCustomsOnlyWizard.ts')
  assert.match(customs, /A saved RateDetail is authoritative, even when the new request is customs-only/)
  assert.match(customs, /props\.rateId && line\.detailId/)
  assert.match(customs, /hasInternationalTransportService\.value \|\| line\.costDetailType !== 'Freight'/)
  assert.match(customs, /shouldIncludePricedLine\(line, lineMatchesPickupCargoCondition\(line\)\)/)
})
