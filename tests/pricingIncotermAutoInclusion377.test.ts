import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { incotermSectionApplicability } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const wizard=file('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
test('FOB export excludes automatic freight and destination; FOB import does not',()=>{
 assert.equal(incotermSectionApplicability('Export','FOB','international_freight'),'other-party')
 assert.equal(incotermSectionApplicability('Export','FOB','destination_charges'),'other-party')
 assert.equal(incotermSectionApplicability('Import','FOB','international_freight'),'client')
})
test('CIF importer insurance and CPT mixed destination are not blindly billed',()=>{
 assert.equal(incotermSectionApplicability('Import','CIF','insurance'),'other-party')
 assert.equal(incotermSectionApplicability('Export','CPT','destination_charges'),'mixed')
})
test('P7 suppresses uncontracted automatic lines for new QUOs, not historical or manually added rows',()=>{
 assert.match(wizard,/function isAutomaticOutsideIncoterm\(line: RateLine\)/)
 assert.match(wizard,/props\.rateId \|\| editingRate\.value \|\| line\.detailId/)
 assert.match(wizard,/line\.manual && !generatedEquipmentFreight/)
 assert.match(wizard,/incotermSectionApplicability\(/)
 assert.match(wizard,/function applyIncotermAutomaticChargeGuard\(\)/)
 assert.match(wizard,/if \(!line\.included \|\| !isAutomaticOutsideIncoterm\(line\)\) continue/)
 assert.match(wizard,/line\.included = false/)
 assert.match(wizard,/watch\(\s*\(\) => \[step\.value, operationType\.value, selectedIncotermCode\.value,/)
})
test('No out-of-term line is included without explicitly scoped acceptance',()=>{
 assert.match(wizard,/const explicitlyQuotedOutsideIncoterm = ref\(new Set<string>\(\)\)/)
 assert.match(wizard,/\[activeCostContextKey\(\), operationType\.value, selectedIncotermCode\.value, line\.key\]/)
 assert.match(wizard,/function quoteOutsideIncotermByAgreement\(line: RateLine\)/)
 assert.match(wizard,/rememberExplicitOutsideIncoterm\(line, true\)/)
 assert.match(wizard,/Cotizar por acuerdo/)
 assert.match(wizard,/const manuallyChosen = selectable && selected\.has\(line\.key\)/)
 assert.match(wizard,/rememberExplicitOutsideIncoterm\(line, manuallyChosen\)/)
})
