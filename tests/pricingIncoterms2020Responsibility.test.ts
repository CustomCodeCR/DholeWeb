import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ICC_INCOTERMS_2020, resolveIncoterm2020, recommendedIncotermPayer,
  requiresIncotermExceptionReason, incotermModeIsRecommended,
} from '../src/modules/pricing/utils/pricingIncoterm2020.ts'

test('eleven ICC 2020 terms and opaque catalogue labels resolve correctly', () => {
  const codes=['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
  assert.deepEqual(Object.keys(ICC_INCOTERMS_2020),codes)
  codes.forEach(code=>assert.equal(resolveIncoterm2020('INC-2026-005',code)?.code,code))
  assert.equal(resolveIncoterm2020('INC-2026-005'),null)
})
test('cost allocation differs from transfer of risk', () => {
  for(const code of ['CFR','CIF','CPT','CIP'])
    assert.equal(resolveIncoterm2020(code)?.sellerPaysMainCarriage,true)
  assert.match(resolveIncoterm2020('CIF')!.riskTransfer,/a bordo/)
  assert.match(resolveIncoterm2020('CIP')!.riskTransfer,/primer transportista/)
  assert.equal(resolveIncoterm2020('CIF')?.mandatorySellerInsurance,true)
  assert.equal(resolveIncoterm2020('CIP')?.mandatorySellerInsurance,true)
})
test('EXW/FCA/FOB and DAP/DPU/DDP distribute paid services by contractual role', () => {
  assert.equal(recommendedIncotermPayer('EXW','exportCustoms'),'Importer')
  assert.equal(recommendedIncotermPayer('FOB','mainFreight'),'Importer')
  assert.equal(recommendedIncotermPayer('CIF','mainFreight'),'Exporter')
  assert.equal(recommendedIncotermPayer('DAP','importCustoms'),'Importer')
  assert.equal(recommendedIncotermPayer('DPU','unloading'),'Exporter')
  assert.equal(recommendedIncotermPayer('DDP','importTaxes'),'Exporter')
  assert.equal(recommendedIncotermPayer('DDP','unloading'),'Importer')
})
test('extraordinary charges depend on contract and exceptions need reason', () => {
  assert.equal(recommendedIncotermPayer('CIF','destinationHandling'),'ByAgreement')
  assert.equal(recommendedIncotermPayer('DAP','demurrageDetention'),'ByAgreement')
  assert.equal(requiresIncotermExceptionReason('FOB','mainFreight','Exporter'),true)
  assert.equal(requiresIncotermExceptionReason('FOB','mainFreight','Importer'),false)
  assert.equal(incotermModeIsRecommended('FOB','Air'),false)
  assert.equal(incotermModeIsRecommended('CPT','Air'),true)
})
test('both live pricing wizards expose full charge stages and Incoterm guidance', () => {
  for(const file of ['PricingAlternativeWizardCrystal.vue','PricingRateExistingWizardStable.vue']){
    const src=readFileSync(new URL('../src/modules/pricing/components/'+file,import.meta.url),'utf8')
    assert.match(src,/<PricingIncotermResponsibilityGuide/)
    assert.match(src,/\.\.\.suggested, \.\.\.sectionOrder/)
  }
})
