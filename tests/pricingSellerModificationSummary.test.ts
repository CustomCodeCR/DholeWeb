import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('seller amendment and new request use the exact same read-only Sales summary component', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  const regular = read('build/pricingWizardLandModeTerminology.ts')
  const handoff = read('src/modules/pricing/components/PricingSellerHandoffPreview.vue')
  assert.match(resume, /import PricingSellerHandoffPreview/)
  assert.match(resume, /<PricingSellerHandoffPreview/)
  assert.match(regular, /<PricingSellerHandoffPreview/)
  assert.match(handoff, /title\?: string/)
  assert.match(handoff, /subtitle\?: string/)
  assert.match(handoff, /01 · Modalidad y cliente/)
  assert.match(handoff, /04 · Carga y comentarios/)
})

test('amendment summary comes from the seller request, not mutable quote fields', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  assert.match(resume, /const modificationSnapshot = computed/)
  assert.match(resume, /const form = payload\?\.form \?\? \{\}/)
  assert.match(resume, /sellerContext: payload\?\.sellerContext \?\? \{\}/)
  assert.match(resume, /pickupLocations: payload\?\.pickupLocations \?\? \[\]/)
  assert.match(resume, /documents: \(payload\?\.supportDocuments \?\? \[\]\)/)
  assert.match(resume, /modification\?\.changes \?\? \[\]/)
  assert.match(resume, /Solicitado por Ventas/)
  assert.match(resume, /StorageService\.downloadFile/)
  assert.match(resume, /:is-land="modificationSnapshot\.form\.modality === 'Land'"/)
})

test('original quote cannot be saved by mistake before seller proposal was applied', () => {
  const plugin = read('build/pricingSellerModificationWizard.ts')
  assert.match(plugin, /props\.modificationRequestId && !pricingModificationApplied\.value/)
  assert.match(plugin, /restoreSellerConsolidatedCargo\(proposal, workPayload\?\.sellerContext\)/)
  assert.match(plugin, /step\.value = 5/)
  assert.match(plugin, /Cargar cambios solicitados y continuar en Pantalla 5/)
  assert.match(plugin, /La tarifa original no se ha guardado ni enviado/)
})

test('amendments retain original quote details and required header values', () => {
  const seller = read('build/pricingSellerModificationWizard.ts')
  const step = read('build/pricingWizardStep4NavigationHardFix.ts')
  const optional = read('build/pricingWizardScreen4CostSelectors.ts')
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')

  assert.match(seller, /const originalFinancialLines = rateLines\.value\.map/)
  assert.match(seller, /rateLines\.value = originalFinancialLines/)
  assert.match(seller, /syncDeclaredCargoInsuranceOnEdit\(\)/)
  assert.match(seller, /const requestedForm = JSON\.parse/)
  assert.match(seller, /'equipmentId', 'validTo'/)
  assert.match(seller, /!modificationComparable\(proposal\[key\]\)/)
  assert.match(seller, /if \(!editingRate\.value && hasInternationalTransportService\.value\)/)
  assert.match(seller, /preserve edited insurance on Screen 7 revisit/)
  assert.match(step, /props\.modificationRequestId && pricingModificationApplied\.value/)
  assert.match(step, /rateLines\.value\.length/)
  assert.match(optional, /props\.modificationRequestId && rateLines\.value\.length/)
  assert.match(resume, /mandatoryHeaders\.has/)
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.match(wizard, /name === 'servicio de agencia'/)
  assert.match(wizard, /normalizeCatalogValue\(line\.currencyName\) === 'crc'/)
})

test('saving a revision keeps seller amendment open until explicit send', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const service = read('src/modules/pricing/services/rateRequestLeaseService.ts')
  const plugin = read('build/pricingSellerModificationWizard.ts')

  const updatePos = wizard.indexOf('await PricingService.updateRate(')
  const staged = wizard.slice(updatePos, wizard.indexOf('const nextRevision =', updatePos))
  assert.match(staged, /pendingModificationDelivery\.value = true/)
  assert.match(staged, /await RateRequestLeaseService\.prepareModification\(/)
  assert.doesNotMatch(staged, /RateRequestLeaseService\.completeRate\(/)
  assert.match(staged, /savedRequest\.status !== 'Open'/)

  const retry = wizard.slice(
    wizard.indexOf('async function retrySavedModificationDelivery()'),
    wizard.indexOf('async function saveRate()'),
  )
  assert.match(retry, /confirmSellerModification: true/)
  assert.match(retry, /CompletedDeliveryRetryPending/)
  assert.match(service, /persisted\.status !== 'Completed'/)
  assert.match(service, /return completion/)

  const navigation = plugin.slice(plugin.indexOf('const stayInRevision ='), plugin.indexOf('const comparisonPanel ='))
  assert.match(navigation, /if \(props\.modificationRequestId\) \{/)
  assert.match(navigation, /await hydrateExistingRate\(\)[\s\S]*?return[\s\S]*?Legacy query-only/)
})
