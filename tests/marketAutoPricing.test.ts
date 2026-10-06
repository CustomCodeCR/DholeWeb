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
    'IA + Average',
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

test('Draft suggestion targets the lower-middle market while respecting the margin floor', async () => {
  const panel = await source('../src/modules/pricing/components/PricingMarketBenchmarkPanel.vue')

  assert.match(panel, /targetPercentile:\s*40/)
  assert.match(panel, /source\.p40/)
  assert.match(panel, /Math\.max\(draftMinimumSalePrice\.value, marketTarget\)/)
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
  assert.match(panel, /draftMinimumSalePrice\.value/)
  assert.match(panel, /El costo es una referencia fija/)
  assert.match(panel, /Costo fijo/)
  assert.match(wizard, /state\.line\.saleAmount\s*=/)
  assert.doesNotMatch(wizard, /state\.line\.costAmount\s*=/)
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
