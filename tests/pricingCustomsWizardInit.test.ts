import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('customs-only wizard registers commercial watch after computed service is initialized', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  const computed = plugin.indexOf("'const hasInternationalTransportService = computed")
  const watcher = plugin.indexOf("'watch([hasInternationalTransportService, draftCommercialTerms]")
  assert.ok(computed >= 0, 'service computed must be declared')
  assert.ok(watcher > computed, 'watch must be registered after service computed')
  assert.ok(!plugin.includes("const commercialDraftAnchor = 'const draftCommercialTermsInitialized = ref(false)'"),
    'do not insert watch into the earlier draft ref initialization')
})

test('CFR through DDP skip tariff selection and never require a freight line', () => {
  const plugin = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  for (const incoterm of ['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']) {
    assert.ok(plugin.includes(incoterm), incoterm + ' must be excluded from freight pricing')
  }
  assert.ok(plugin.includes('freightNotRequiredByIncoterm.value && selectedServices.value.some'),
    'the Incoterm exclusion must participate in the service-based freight calculation')
  assert.ok(plugin.includes("form.selectedImportRateId = ''"),
    'a prepaid Incoterm must not retain a selected imported tariff')
  assert.ok(plugin.includes("'    form.freightCost = 0'"),
    'freight cost must be reset when the Incoterm switches to no-freight')
  assert.ok(plugin.includes("'    form.freightSale = 0'"),
    'freight sale must be reset when the Incoterm switches to no-freight')
  assert.ok(plugin.includes("'  if (!hasInternationalTransportService.value && step.value === 5) step.value = 6'"),
    'Tarifas (step 5) must be skipped')
  assert.ok(plugin.includes("const includedLines = computed(() => rateLines.value.filter((line) => (hasInternationalTransportService.value"),
    'submitted detail lines must omit freight when the Incoterm has no freight')
})
