import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMaritimeOnlyIncoterm } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('only four ocean Incoterms are restricted on single-mode land and air', () => {
  for (const code of ['FAS', 'FOB', 'CFR', 'CIF']) assert.equal(isMaritimeOnlyIncoterm(code), true)
  for (const code of ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']) assert.equal(isMaritimeOnlyIncoterm(code), false)
  assert.equal(isMaritimeOnlyIncoterm('Incoterm FOB 2020'), true)
})
test('no Pricing runtime computed references a local, possibly transformed-away identifier', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const util = read('src/modules/pricing/utils/pricingIncotermPerspective.ts')
  const diagnostics = read('scripts/diagnose-pricing-bundle.mjs')
  assert.doesNotMatch(wizard, /\bmaritimeOnlyIncoterms\b/)
  assert.match(wizard, /import \{[^}]*isMaritimeOnlyIncoterm[^}]*\} from '@\/modules\/pricing\/utils\/pricingIncotermPerspective'/)
  assert.match(wizard, /isMaritimeOnlyIncoterm\(selectedIncotermCode\.value\)/)
  assert.match(wizard, /isMaritimeOnlyIncoterm\(code\)/)
  assert.match(util, /export function isMaritimeOnlyIncoterm\(code: string\)/)
  assert.match(diagnostics, /'maritimeOnlyIncoterms'/)
})
