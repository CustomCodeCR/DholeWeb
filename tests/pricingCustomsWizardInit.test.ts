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
