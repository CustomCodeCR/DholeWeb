import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const sellerPlugin = readFileSync(new URL('../build/pricingSellerRateRequests.ts', import.meta.url), 'utf8')
const editPlugin = readFileSync(new URL('../build/pricingSellerRequestEdit.ts', import.meta.url), 'utf8')
const duplicatePlugin = readFileSync(new URL('../build/pricingSellerRequestDuplicate.ts', import.meta.url), 'utf8')

test('seller maritime FCL uses the shared multi-POE selector without referencing an injected prop in the template', () => {
  assert.equal((wizard.match(/v-if="!isEditing && \(!sellerRequestMode \|\| !sellerModificationSourceActive\) && form\.modality === 'Maritime' && shipmentModeForApi === 'Fcl'"/g) ?? []).length, 2)
  assert.match(wizard, /sellerModificationSourceActive = computed/)
  assert.doesNotMatch(wizard, /!props\.sellerModificationRateId\) && form\.modality/)
  assert.match(wizard, /@update:model-values="setSelectedPoeIds"/)
})

test('seller request persists and resumes all FCL POEs, including edit and duplicate', () => {
  assert.match(sellerPlugin, /selectedPoeIds: form\.modality/)
  assert.match(sellerPlugin, /selectedPoeNames: form\.modality/)
  assert.match(sellerPlugin, /const requestedPoeIds = request\.payload\?\.selectedPoeIds/)
  assert.match(editPlugin, /const requestedPoeIds = request\.payload\.selectedPoeIds/)
  assert.match(duplicatePlugin, /const originalPoeIds = original\.payload\.selectedPoeIds/)
})
