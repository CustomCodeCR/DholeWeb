import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const picker = source('src/modules/pricing/components/PricingCrmClientSelect.vue')
const identity = source('build/pricingCommercialIdentityFields.ts')
const delegated = source('build/pricingSellerDelegatedRequests.ts')
const multimodal = source('build/pricingSellerMultimodalStep3Fix.ts')
const compatibility = source('build/pricingRequirements20260908PreCompat.ts')

test('Linked quotations hydrate their CRM account and current seller by exact ID', () => {
  assert.match(picker, /selectedClientId: id/)
  assert.match(picker, /result\.items\.find\(item => item\.id\.toLowerCase\(\) === id\.toLowerCase\(\)\)/)
  assert.match(picker, /emit\('selected', client\)/)
  assert.match(picker, /props\.modelValue !== id/)
})

test('Normal seller requests do not discard the CRM executive before POST', () => {
  assert.match(compatibility, /props\.sellerRequestMode && !form\.clientId && sellerExecutiveLabel\.value/)
  assert.match(delegated, /if \(!form\.clientId\) \{\s*form\.executiveId = selected\?\.value/)
  assert.match(identity, /CRM identity validation for normal seller requests/)
  assert.match(identity, /Seleccione una cuenta o prospecto del CRM con un ejecutivo comercial asignado/)
})

test('Multimodal requests retain their CRM seller and historical unlinked quotes can be amended', () => {
  assert.match(multimodal, /if \(form\.clientId\) \{/)
  assert.match(multimodal, /name\.toLowerCase\(\) === 'castro fallas'/)
  assert.match(identity, /historicUnlinkedModification/)
  assert.match(identity, /historicUnlinkedSellerModification/)
})
