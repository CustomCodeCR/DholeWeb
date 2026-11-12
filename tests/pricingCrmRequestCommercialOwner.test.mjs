import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const picker = source('src/modules/pricing/components/PricingCrmClientSelect.vue')
const identity = source('build/pricingCommercialIdentityFields.ts')
const modification = source('build/pricingSellerModificationWizard.ts')
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

test('Pricing modification reloads the CRM owner by ID before save, even when screen 3 is unmounted', () => {
  assert.match(identity, /async function refreshModificationCrmOwner\(\)/)
  assert.match(identity, /props\.modificationRequestId && editingRate\.value/)
  assert.match(identity, /selectedClientId: clientId/)
  assert.match(identity, /item\.id\.toLowerCase\(\) === clientId\.toLowerCase\(\)/)
  assert.match(identity, /if \(!\(await refreshModificationCrmOwner\(\)\)\) return/)
  assert.match(identity, /form\.executiveId = castroFallas \? '' : executiveId/)
  assert.match(identity, /form\.crmClientKind = client\.kind/)
})

test('Existing modifications reject an unavailable seller and retain unlinked legacy compatibility', () => {
  assert.match(identity, /executiveId === '00000000-0000-0000-0000-000000000000'/)
  assert.match(identity, /executiveName\.toLowerCase\(\) === 'vendedor no disponible'/)
  assert.match(identity, /!editingRate\.value\.clientLeadId && !form\.clientId/)
  assert.match(identity, /La cuenta o prospecto vinculado no tiene un vendedor activo en CRM/)
  assert.match(identity, /No se pudo consultar CRM para validar el ejecutivo comercial/)
})

test('Solicitudes normales y de modificación recuperan también el ejecutivo de prospectos CRM por ID', () => {
  assert.match(identity, /if \(!pricingModification && !props\.sellerRequestMode && !form\.clientId\) return true/)
  assert.match(identity, /mode: props\.sellerRequestMode \? 'request' : 'create'/)
  assert.match(identity, /async function saveOpenRequest\(\) \{\s*if \(!\(await refreshModificationCrmOwner\(\)\)\) return/)
  assert.match(identity, /form\.crmClientKind = client\.kind/)
  assert.match(identity, /form\.executiveId = castroFallas \? '' : executiveId/)
  assert.match(identity, /La cuenta o prospecto vinculado no está disponible en CRM/)
  assert.match(identity, /La cuenta o prospecto vinculado no tiene un vendedor activo en CRM/)
})

test('Las solicitudes de modificación de vendedores con prospecto revalidan el ejecutivo CRM antes del POST', () => {
  assert.match(modification, /async function submitSellerModification\(\)/)
  assert.match(modification, /if \(!source \|\| saving\.value\) return\s+\/\/ Seller amendments/)
  assert.match(modification, /if \(!\(await refreshModificationCrmOwner\(\)\)\) return/)
  assert.match(identity, /mode: props\.sellerRequestMode \? 'request' : 'create'/)
})

test('Prospecto institucional conserva Castro Fallas en la selección y al restaurar el borrador', () => {
  const wizard = source('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /client\?\.isCastroFallasExecutive === true/)
  assert.match(wizard, /form\.executiveName = 'Castro Fallas'/)
  assert.match(wizard, /if \(form\.crmClientKind\) return/)
  assert.match(identity, /!props\.sellerRequestMode && !form\.clientId/)
  assert.match(identity, /if \(form\.clientId\) await refreshModificationCrmOwner\(\)/)
})

test('Prospecto TARIFARIO se crea como maestro incluso desde un borrador SPOT', () => {
  const wizard = source('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /client\?\.displayName \?\? ''\)\.toLocaleUpperCase\(\)\.includes\('TARIFARIO'\)/)
  assert.match(wizard, /form\.rateType = 'Tariff'/)
  assert.match(identity, /form\.clientName\.toLocaleUpperCase\(\)\.includes\('TARIFARIO'\)/)
  assert.match(identity, /form\.rateType = 'Tariff'/)
})
