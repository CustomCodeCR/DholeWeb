import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const own = readFileSync('build/pricingWizardOwnLclLinePersistence.ts', 'utf8')
const exw = readFileSync('build/pricingExwFcaVariableCosts.ts', 'utf8')

test('EXW own LCL exposes editable pickup even without a configured cost', () => {
  assert.match(own, /function ensureOwnLclExwPickupLine\(\)/)
  assert.match(own, /props\.viewOnly \|\| selectedIncotermCode\.value !== 'EXW'/)
  assert.match(own, /key: 'variable-section:pickup_origin'/)
  assert.match(own, /costType: 'Variable'/)
  assert.match(own, /costAmount: 0,/)
  assert.match(own, /saleAmount: 0,/)
  assert.match(own, /pickupLocations\.value\.length \? 'PerPickup'/)
})

test('own LCL preserves manual pickup prices through matrix rebuild and save', () => {
  assert.match(own, /if \(operatorEntered && !line\.costId\) return true/)
  assert.match(own, /Boolean\(line\.detailId\) \|\| line\.manual/)
  assert.match(own, /line\.key === 'variable-section:pickup_origin'/)
  assert.match(own, /ownLclKeepQuotedLine\(line, \$\{detailsMapperAnchor\}\)/)
  assert.match(own, /sourceDetails\.map\(\(line\) =>/)
})

test('EXW configured pickup survives source-aware own LCL filter', () => {
  assert.match(own, /String\(line\.key \?\? ''\)\.startsWith\('exw-fca-variable-cost:'\)/)
  assert.match(own, /selectedIncotermCode\.value === 'EXW' && line\.section === 'pickup_origin'/)
  assert.match(exw, /sectionForCost\(cost\) === 'pickup_origin'/)
})

test('other catalog charges remain excluded and view-only snapshots are not generated', () => {
  assert.match(own, /if \(props\.viewOnly \|\| selectedIncotermCode\.value !== 'EXW'\) return/)
  assert.match(own, /!line\.costId \|\| \(selectedIncotermCode\.value === 'EXW'/)
  assert.match(own, /if \(ownLclFromMatrix\(line\.notes\)\) return true/)
  assert.match(own, /if \(!name\.startsWith\('manejos'\) \|\| !\(line\.detailId \|\| line\.id\)\) return false/)
})
