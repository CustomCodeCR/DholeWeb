import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { PRICING_SCOPES } from '../src/core/auth/scopes.ts'

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

test('Pantalla 7 exposes Average suggestion before the final draft and keeps cost immutable', async () => {
  const wizard = await source('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  const screen7 = wizard.indexOf('v-else-if="step === 7"')
  const marketPanel = wizard.indexOf('<PricingMarketBenchmarkPanel', screen7)
  const screen8 = wizard.indexOf('v-else-if="step === 8"')

  assert.ok(screen7 >= 0, 'Pantalla 7 was not found')
  assert.ok(marketPanel > screen7, 'Average suggestion must be rendered inside Pantalla 7')
  assert.ok(screen8 > marketPanel, 'Average suggestion must appear before Pantalla 8')
  assert.equal(
    wizard.slice(screen8).includes('<PricingMarketBenchmarkPanel'),
    false,
    'Pantalla 8 must remain a final draft/review screen, not the pricing suggestion step',
  )

  assert.match(wizard, /:context="marketPricingContext"/)
  assert.match(wizard, /:draft-cost-total-usd="totalCostUsd"/)
  assert.match(wizard, /:draft-sale-total-usd="totalSaleBeforeTaxUsd"/)
  assert.match(wizard, /@apply-draft-suggestion="applyDraftMarketSaleSuggestion"/)
  assert.match(wizard, /state\.line\.saleAmount\s*=/)
  assert.doesNotMatch(wizard, /state\.line\.costAmount\s*=/)

  for (const label of [
    'Average · precio automático',
    'Market Position',
    'Suggested Price',
    'Confidence',
    'Competitor Observations',
    'Aplicar sugerencia solo a ventas',
    'Ajustes automáticos',
    'Aplicar precio sugerido',
    'Recalcular',
    'Ajustar manualmente',
    'Aprobar tarifa',
  ]) {
    assert.ok(panel.includes(label), `Missing Market Pricing UI label: ${label}`)
  }
})

test('Average computes the draft price automatically without waiting for AI inference', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')
  const draftMethod = panel.split('async function calculateDraftBenchmark() {')[1]
    ?.split('async function calculateAutoPricing(')[0] || ''

  assert.match(draftMethod, /await MarketPricingService\.calculateMarketBenchmark/)
  assert.match(draftMethod, /benchmark\.value = nextBenchmark/)
  assert.doesNotMatch(draftMethod, /analyzeDraftMarketWithAi\s*\(/)
  assert.match(panel, /@click="analyzeDraftMarketWithAi"/)
  assert.match(panel, /draftBenchmarkRequestId/)
  assert.match(panel, /setTimeout\(/)
  assert.match(panel, /draftSuggestedSalePrice = computed/)
  assert.match(panel, /canCalculateBenchmark\.value && canDraftBenchmark\.value/)
})

test('Market result is presented as range, target, ceiling, confidence and sample instead of one exact value', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  for (const fragment of [
    'Rango P25–P75',
    'Target competitivo bajo (P40)',
    'Target P60',
    'Competitive Ceiling',
    'Confidence',
    'Tarifas comparables',
    'Competidores',
    'marketStats.p25',
    'marketStats.p40',
    'marketStats.p75',
    'marketStats.targetMarketPrice',
    'marketStats.competitiveCeiling',
    'marketStats.confidenceScore',
    'marketStats.observationCount',
  ]) {
    assert.ok(panel.includes(fragment), `Missing non-exact market context: ${fragment}`)
  }

  assert.match(panel, /No existe suficiente mercado comparable para auto-aplicar una tarifa/)
  assert.match(panel, /Dhole no debe inventar un precio de alta confianza/)
})

test('Draft suggestion stays near the lower-middle market and treats margin as an approval threshold', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.match(panel, /targetPercentile:\s*40/)
  assert.match(panel, /source\.p40/)
  assert.match(panel, /draftCostFloorPrice/)
  assert.match(panel, /Math\.max\(draftCostFloorPrice\.value, marketSuggestion\)/)
  assert.match(panel, /UMBRAL DE APROBACIÓN/)
  assert.match(panel, /requiere aprobación, pero no se infla por encima del mercado/)
  assert.match(panel, /minimumMarginPercentage/)
  assert.match(panel, /applyDraftSuggestion/)
  assert.match(panel, /El costo es una referencia fija/)
})

test('AI recommendation is bounded by Average and can never modify cost', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')
  const wizard = await source('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

  assert.match(panel, /AiService\.executeStructured/)
  assert.match(panel, /profileKey:\s*'assistant'/)
  assert.match(panel, /clampDraftAiSuggestion/)
  assert.match(panel, /stats\.p25/)
  assert.match(panel, /stats\.p50/)
  assert.match(panel, /draftCostFloorPrice\.value/)
  assert.match(panel, /El costo es una referencia fija/)
  assert.match(panel, /Costo fijo/)
  assert.match(wizard, /state\.line\.saleAmount\s*=/)
  assert.doesNotMatch(wizard, /state\.line\.costAmount\s*=/)
})

test('Draft auto-apply distributes sale changes from the existing sale structure instead of dumping them into freight', async () => {
  const wizard = await source('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

  assert.match(wizard, /currentAdjustableSaleUsd/)
  assert.match(wizard, /targetAdjustableSaleUsd/)
  assert.match(wizard, /saleShare \* 0\.80/)
  assert.match(wizard, /costShare \* 0\.20/)
  assert.match(wizard, /state\.saleTotalUsd \+ \(deltaUsd \* share\)/)
  assert.match(wizard, /state\.saleTotalUsd \* factor/)
  assert.match(wizard, /roundingResidualUsd/)
  assert.match(wizard, /requestedTarget = Math\.max\(targetSaleUsd, totalCostUsd\.value\)/)
  assert.doesNotMatch(wizard, /minimumSaleByMargin/)
  assert.doesNotMatch(wizard, /line\.costAmount\s*=/)
})

test('Competitor observations expose traceability fields, weights and inclusion state', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  for (const column of [
    'Empresa',
    'Incoterm',
    'POL',
    'POE',
    'POD',
    'Equipo',
    'Modalidad',
    'Naviera',
    'Tarifa',
    'Vigencia',
    'Match %',
    'Peso',
    'Estado',
  ]) {
    assert.ok(panel.includes(column), `Missing observation audit column: ${column}`)
  }

  assert.match(panel, /observation\.comparabilityScore/)
  assert.match(panel, /observation\.finalWeight/)
  assert.match(panel, /observation\.wasIncluded/)
  assert.match(panel, /observation\.exclusionReason/)
})

test('Average shows only included tariffs and opens the correct source document', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')
  const contracts = await source('../src/core/interfaces/marketPricing.ts')
  const fileModal = await source('../src/modules/pricing/components/PricingCompetitorTariffFileModal.vue')

  assert.match(panel, /rows\.filter\(observation => observation\.wasIncluded && !observation\.isOutlier\)/)
  assert.match(panel, /@click="openCompetitorSource\(observation\)"/)
  assert.match(panel, /PricingService\.getCompetitorTariff\(tariffId\)/)
  assert.match(panel, /sourceStorageId\.value = tariff\.storageId/)
  assert.match(panel, /<PricingCompetitorTariffFileModal/)
  assert.match(contracts, /competitorTariffId\?: string \| null/)
  assert.match(fileModal, /<StorageFileViewer/)
})

test('Applying Average sale requires a margin comparison confirmation for both increases and decreases', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.match(panel, /const hasAvailableAverage = computed/)
  assert.match(panel, /marketStats\.value\.observationCount > 0/)
  assert.match(panel, /marketObservations\.value\.length > 0/)
  assert.match(panel, /if \(!hasAvailableAverage\.value \|\| suggestedSale == null/)
  assert.match(panel, /const currentMargin = currentSale > 0/)
  assert.match(panel, /const suggestedMargin = suggestedSale > 0/)
  assert.match(panel, /const marginDifference = suggestedMargin - currentMargin/)
  assert.match(panel, /direction: marginDifference > 0\.005 \? 'higher' : marginDifference < -0\.005 \? 'lower'/)
  assert.match(panel, /v-if="!rateId && !viewOnly && draftSaleComparison"/)
  assert.match(panel, /@click="applyDraftSuggestedPrice"/)
  assert.match(panel, /showDraftSuggestionConfirmation\.value = true/)
  assert.match(panel, /title="Confirmar venta sugerida por Average"/)
  assert.match(panel, /El margen de utilidad aumentará/)
  assert.match(panel, /El margen de utilidad disminuirá/)
  assert.match(panel, /Mantener venta actual/)
  assert.match(panel, /@click="confirmDraftSuggestedPrice"/)
  assert.match(panel, /emit\('applyDraftSuggestion', target\)/)
  assert.match(panel, /Costo sin cambios/)
  assert.match(panel, /La aplicación no omite las aprobaciones de Pricing/)

  const openHandler = panel.split('function applyDraftSuggestedPrice() {')[1]
    ?.split('function confirmDraftSuggestedPrice() {')[0] ?? ''
  assert.doesNotMatch(openHandler, /emit\('applyDraftSuggestion'/)
  assert.match(openHandler, /!draftSaleComparison\.value/)
})

test('Pantalla 7 opens the Average sale confirmation automatically once after valid data loads', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')
  const wizard = await source('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

  // The wizard mounts a fresh market panel upon entering step 7.
  const step7 = wizard.indexOf('v-else-if="step === 7"')
  const marketPanel = wizard.indexOf('<PricingMarketBenchmarkPanel', step7)
  const step8 = wizard.indexOf('v-else-if="step === 8"')
  assert.ok(step7 >= 0 && marketPanel > step7 && step8 > marketPanel)

  assert.match(panel, /const hasAutoOpenedDraftSuggestion = ref\(false\)/)
  assert.match(panel, /watch\(\s*\[draftSaleComparison, working\]/)
  assert.match(panel, /hasAutoOpenedDraftSuggestion\.value\s*\|\| props\.rateId/)
  assert.match(panel, /\|\| props\.viewOnly/)
  assert.match(panel, /\|\| isWorking/)
  assert.match(panel, /\|\| !comparison/)
  assert.match(panel, /hasAutoOpenedDraftSuggestion\.value = true/)
  assert.match(panel, /showDraftSuggestionConfirmation\.value = true/)
  assert.match(panel, /\{ immediate: true, flush: 'post' \}/)
  assert.match(panel, /@close="showDraftSuggestionConfirmation = false"/)
  assert.match(panel, /@click="applyDraftSuggestedPrice"/)
  assert.match(panel, /marketStats\.value\.observationCount > 0/)
  assert.match(panel, /marketObservations\.value\.length > 0/)

  const automatic = panel.split('[draftSaleComparison, working],')[1]
    ?.split("{ immediate: true, flush: 'post' }")[0] || ''
  assert.doesNotMatch(automatic, /emit\('applyDraftSuggestion'/)
})

test('Manual override never submits fixed charges and requires an audit reason', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.match(panel, /filter\(\(detail\) => detail\.costType !== 'Fixed'\)/)
  assert.match(panel, /overrideReason\.value\.trim\(\)/)
  assert.match(panel, /reason: overrideReason\.value\.trim\(\)/)
  assert.match(panel, /detail\.costType === 'Fixed'/)
  assert.match(panel, /Restaurar valores originales/)
})

test('Market Pricing endpoints and service cover calculate, get, apply, recalculate, override and approve', async () => {
  const endpoints = await source('../src/core/composables/endpoints.ts')
  const service = await source('../src/core/services/marketPricingService.ts')

  for (const path of [
    '/api/pricing/market-benchmark/calculate',
    '/api/pricing/rates/{{rateId}}/market-benchmark',
    '/api/pricing/rates/{{rateId}}/auto-pricing/calculate',
    '/api/pricing/rates/{{rateId}}/auto-pricing/recalculate',
    '/api/pricing/rates/{{rateId}}/auto-pricing',
    '/api/pricing/rates/{{rateId}}/auto-pricing/apply',
    '/api/pricing/rates/{{rateId}}/auto-pricing/override',
    '/api/pricing/rates/{{rateId}}/auto-pricing/approve',
  ]) {
    assert.ok(endpoints.includes(path), `Missing Market Pricing endpoint: ${path}`)
  }

  for (const operation of [
    'calculateMarketBenchmark',
    'getRateMarketBenchmark',
    'calculateAutoPricing',
    'recalculateAutoPricing',
    'getAutoPricing',
    'applyAutoPricing',
    'overrideAutoPricing',
    'approveAutoPricing',
  ]) {
    assert.ok(service.includes(operation), `Missing Market Pricing service operation: ${operation}`)
  }

  assert.equal(/\bfetch\s*\(/.test(service), false)
  assert.match(service, /callEndpoint/)
})

test('Market Pricing UI actions are guarded by granular scopes', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.equal(PRICING_SCOPES.marketBenchmark.view, 'pricing.market-benchmark.view')
  assert.equal(PRICING_SCOPES.marketBenchmark.calculate, 'pricing.market-benchmark.calculate')
  assert.equal(PRICING_SCOPES.autoPricing.view, 'pricing.auto-pricing.view')
  assert.equal(PRICING_SCOPES.autoPricing.calculate, 'pricing.auto-pricing.calculate')
  assert.equal(PRICING_SCOPES.autoPricing.apply, 'pricing.auto-pricing.apply')
  assert.equal(PRICING_SCOPES.autoPricing.override, 'pricing.auto-pricing.override')
  assert.equal(PRICING_SCOPES.autoPricing.approve, 'pricing.auto-pricing.approve')

  for (const scope of [
    'PRICING_SCOPES.marketBenchmark.view',
    'PRICING_SCOPES.marketBenchmark.calculate',
    'PRICING_SCOPES.autoPricing.view',
    'PRICING_SCOPES.autoPricing.calculate',
    'PRICING_SCOPES.autoPricing.apply',
    'PRICING_SCOPES.autoPricing.override',
    'PRICING_SCOPES.autoPricing.approve',
  ]) {
    assert.ok(panel.includes(scope), `Missing scope guard: ${scope}`)
  }
})

test('Multi-equipment pricing requests benchmark each selected equipment explicitly', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.match(panel, /Benchmark por equipo/)
  assert.match(panel, /selectedEquipmentId/)
  assert.match(panel, /containerTypeId: selectedEquipmentId\.value/)
  assert.match(panel, /hasMultipleEquipment/)
})

test('Air and AirConsol are not silently converted to FCL in the wizard', async () => {
  const contracts = await source('../src/core/interfaces/pricing.ts')
  const wizard = await source('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')

  assert.match(contracts, /'Air'/)
  assert.match(contracts, /'AirConsol'/)
  assert.match(wizard, /return 'AirConsol'/)
  assert.match(wizard, /return 'Air'/)
})
