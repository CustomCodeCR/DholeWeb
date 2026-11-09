import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldUseFclPanamaCostaRicaAllIn } from '../src/modules/pricing/utils/pricingPanamaCostaRicaAllIn.ts'
import { readFileSync } from 'node:fs'

const port = (label: string, code = '', countryCode = '') => ({
  label, value: label, code, slug: '', metadataJson: countryCode ? JSON.stringify({ countryCode }) : null,
})
const costaRica = port('San José, Costa Rica', 'CRSJO', 'CR')
const panamaPoes = [port('Rodman, Panamá'), port('Balboa, Panamá'), port('Multimodal Vía Panamá', 'MULTIMODAL_VIA_PANAMA')]

test('ALL IN applies individually to maritime FCL Panama to Costa Rica, including real and virtual Panama POEs', () => {
  for (const poe of panamaPoes) {
    assert.equal(shouldUseFclPanamaCostaRicaAllIn({
      modality: 'Maritime', shipmentMode: 'Fcl', poe, pod: costaRica,
    }), true)
  }
})

test('Caldera, Moín and other non-Panama alternatives NEVER inherit ALL IN from a Panama option', () => {
  for (const poe of [port('Puerto Caldera, Costa Rica', 'CRCAL', 'CR'), port('Puerto Moín, Costa Rica')]) {
    assert.equal(shouldUseFclPanamaCostaRicaAllIn({
      modality: 'Maritime', shipmentMode: 'Fcl', poe, pod: costaRica,
    }), false)
  }
})

test('ALL IN is disabled for LCL/FTL and Panama destinations outside Costa Rica', () => {
  for (const shipmentMode of ['Lcl', 'Ftl', 'Ltl']) {
    assert.equal(shouldUseFclPanamaCostaRicaAllIn({
      modality: 'Maritime', shipmentMode, poe: panamaPoes[0], pod: costaRica,
    }), false)
  }
  for (const pod of [port('Balboa, Panamá', 'PABLB', 'PA'), port('Cartagena, Colombia', '', 'CO'), null]) {
    assert.equal(shouldUseFclPanamaCostaRicaAllIn({
      modality: 'Maritime', shipmentMode: 'Fcl', poe: panamaPoes[0], pod,
    }), false)
  }
  assert.equal(shouldUseFclPanamaCostaRicaAllIn({
    modality: 'Land', shipmentMode: 'Fcl', poe: panamaPoes[0], pod: costaRica,
  }), false)
})

test('saved MultiQUO assigns ALL IN per route, rather than inheriting one shared payload', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.ok(wizard.includes('useAllInPresentation: shouldUseFclPanamaCostaRicaAllIn({'))
  assert.ok(wizard.includes('poe: targetPoe'))
  assert.ok(wizard.includes('ALL IN · Panamá → Costa Rica'))
  const plugin = readFileSync(new URL('../build/pricingWizardMaritimePanamaFix.ts', import.meta.url), 'utf8')
  assert.ok(plugin.includes('shouldUseFclPanamaCostaRicaAllIn'))
})
