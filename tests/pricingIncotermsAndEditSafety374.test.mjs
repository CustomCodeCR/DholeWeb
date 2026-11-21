import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = file('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const stable = file('src/modules/pricing/components/PricingRateExistingWizardStable.vue')

test('Incoterms are modal: maritime and multimodal include all, air and land reject 4 maritime only', () => {
  assert.match(wizard, /isMaritimeOnlyIncoterm\(code\)/)
  assert.match(wizard, /isMaritimeOnlyIncoterm\(selectedIncotermCode\.value\)/)
  assert.match(wizard, /form\.modality === 'Maritime' \|\| form\.modality === 'Multimodal'/)
  assert.match(wizard, /!isMaritimeOnlyIncoterm\(code\)/)
  assert.match(wizard, /props\.rateId && form\.incotermId === item\.id/)
})
test('Commercial direction is compact but manual override and automatic reset remain available', () => {
  assert.match(wizard, /showCommercialOperationControls/)
  assert.match(wizard, /Cambiar operación/)
  assert.match(wizard, /pricingQuoteOperationOverride \? '\(manual\)' : '\(automática\)'/)
  assert.match(wizard, /value: '', label: 'Automático según cliente y ruta'/)
})
test('Term-specific documentary requirements do not create or silently remove charges', () => {
  for(const term of ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']) {
    assert.match(wizard, new RegExp('    ' + term + ':'))
  }
  assert.match(wizard, /no elimina cargos contratados ni crea seguros o fletes nuevos/)
})
test('Both wizards fail closed when a persisted RateDetail ID is missing from the edit snapshot', () => {
  for(const src of [wizard,stable]) {
    assert.match(src, /const missingPersistedDetailIds = \[\.\.\.originalDetailIds\]/)
    assert.match(src, /if \(missingPersistedDetailIds\.length > 0\) \{/)
    assert.match(src, /const removedExtraDetailIds: string\[\] = \[\]/)
    assert.match(src, /replaceExtraDetails: true/)
    assert.match(src, /expectedRevisionNumber: editingRate\.value\.revisionNumber/)
  }
})
