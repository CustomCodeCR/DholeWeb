import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const accountHub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const manager = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')

test('migration is visible only to superadministrator roles, not ordinary Admin or Administrador', () => {
  assert.match(accountHub, /const canManageHistoricalQuoteLinks = computed/)
  for (const role of ['SuperAdmin', 'SuperAdministrador', 'SuperUsuario', 'SuperUser']) {
    assert.match(accountHub, new RegExp("'" + role + "'"))
  }
  assert.doesNotMatch(accountHub, /canManageHistoricalQuoteLinks[^\n]*hasScope/)
  assert.equal((accountHub.match(/<details v-if="canManageHistoricalQuoteLinks"/g) || []).length, 2)
  assert.equal((accountHub.match(/<CrmLegacyQuoteManager/g) || []).length, 2)
})

test('both legacy sections render as a collapsed and lazy-loaded accordion', () => {
  assert.match(accountHub, /const legacyQuoteLinksExpanded = ref\(false\)/)
  assert.equal((accountHub.match(/:open="legacyQuoteLinksExpanded"/g) || []).length, 2)
  assert.equal((accountHub.match(/@toggle="onLegacyQuoteLinksToggle"/g) || []).length, 2)
  assert.equal((accountHub.match(/v-if="legacyQuoteLinksExpanded"/g) || []).length, 2)
  assert.equal((accountHub.match(/Vinculación de QUO históricas · Superadministración/g) || []).length, 2)
  assert.match(accountHub, /function onLegacyQuoteLinksToggle\(event: Event\)/)
})

test('ordinary CRM quotes and indicators remain accessible outside the administrative accordion', () => {
  assert.match(accountHub, /<CrmAccountQuotesDashboard/)
  assert.match(accountHub, /Rutas de cotizaciones \(Pricing\)/)
  assert.match(manager, /crm-legacy-reconcile/)
  assert.match(accountHub, /@changed="handleQuoteLinked"/)
})
