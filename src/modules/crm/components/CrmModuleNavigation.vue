<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { CRM_WORKSPACE_SCOPES } from '@/core/auth/scopes'

const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const entries = [
  { path: '/crm', key: 'dashboard', scopes: CRM_WORKSPACE_SCOPES },
  { path: '/crm/accounts', key: 'accounts', scopes: ['crm.account.read', 'crm.account.read-all'] },
  { path: '/crm/contacts', key: 'contacts', scopes: ['crm.contact.read'] },
  { path: '/crm/leads', key: 'leads', scopes: ['crm.lead.read', 'crm.lead.read-all'] },
  { path: '/crm/opportunities', key: 'opportunities', scopes: ['crm.opportunity.read', 'crm.opportunity.read-all'] },
  { path: '/crm/activities', key: 'activities', scopes: ['crm.activity.read', 'crm.activity.read-all'] },
  { path: '/crm/followups', key: 'followups', scopes: ['crm.followup.manage', 'crm.task.manage'] },
  { path: '/crm/analyses', key: 'analyses', scopes: ['crm.analysis.read', 'crm.analysis.manage'] },
  { path: '/crm/finance', key: 'finance', scopes: ['crm.credit.read', 'crm.contract.read'] },
  { path: '/crm/settings', key: 'settings', scopes: ['crm.settings.manage'] },
]
const visible = computed(() => entries.filter(item =>
  item.scopes.some(scope => auth.hasScope(scope))))
function active(path: string) {
  return path === '/crm' ? route.path === '/crm' :
    route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <nav data-crm-module-navigation aria-label="Módulos CRM"
    class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-2 shadow-sm">
    <div class="flex gap-1 overflow-x-auto" role="navigation">
      <RouterLink v-for="entry in visible" :key="entry.path" :to="entry.path"
        :aria-current="active(entry.path) ? 'page' : undefined"
        class="shrink-0 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors"
        :class="active(entry.path)
          ? 'bg-[var(--dh-primary)] text-white'
          : 'text-[var(--dh-text-muted)] hover:bg-[var(--dh-shell)] hover:text-[var(--dh-text)]'">
        {{ t('crm.nav.' + entry.key) }}
      </RouterLink>
    </div>
  </nav>
</template>
