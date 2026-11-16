import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const scopes = readFileSync('src/core/auth/scopes.ts', 'utf8')
const router = readFileSync('src/core/router/index.ts', 'utf8')
const sidebar = readFileSync('src/shared/components/layouts/MainLayout.vue', 'utf8')
const screen = readFileSync('src/modules/pricing/views/PricingOwnLclView.vue', 'utf8')

test('own LCL exposes independent create, update and view scopes', () => {
  assert.match(scopes, /ownLclConsolidations:\s*\{\s*create:\s*'pricing\.own-lcl-consolidation\.create',\s*update:\s*'pricing\.own-lcl-consolidation\.update',\s*view:\s*'pricing\.own-lcl-consolidation\.view'/)
})
test('console and sidebar require view, not create', () => {
  assert.match(router, /name: 'pricing-own-lcl',[\s\S]{0,230}requiredScope: PRICING_SCOPES\.ownLclConsolidations\.view/)
  assert.match(sidebar, /canView\(PRICING_SCOPES\.ownLclConsolidations\.view\)\)\s*\{\s*ownConsolidationChildren\.push/)
})
test('create and update UI controls cannot bypass API permissions', () => {
  assert.match(screen, /canCreateConsolidation = computed\(\(\) => authStore\.hasScope\(PRICING_SCOPES\.ownLclConsolidations\.create\)\)/)
  assert.match(screen, /canUpdateConsolidation = computed\(\(\) => authStore\.hasScope\(PRICING_SCOPES\.ownLclConsolidations\.update\)\)/)
  assert.match(screen, /v-if="canUpdateConsolidation" :icon="Edit3"/)
  assert.match(screen, /if \(!selectedId\.value \|\| readOnly\.value \|\| !canUpdateConsolidation\.value\) return/)
  assert.match(screen, /if \(hydratingPricingEditor\.value \|\| readOnly\.value \|\| !canUpdateConsolidation\.value/)
})
test('quote navigation still requires rate view', () => {
  assert.match(screen, /canOpenLinkedQuote = computed\(\(\) => authStore\.hasScope\(PRICING_SCOPES\.rates\.view\)\)/)
  assert.match(screen, /v-if="canOpenLinkedQuote" label="Ver QUO"/)
})
