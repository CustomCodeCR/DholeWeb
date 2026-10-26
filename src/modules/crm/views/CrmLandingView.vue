<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { useI18n } from 'vue-i18n'
import { crmEnabled } from '../services/crmApi'

const { t } = useI18n()
const auth = useAuthStore()
const sections = [
  { path: '/crm/accounts', label: 'crm.nav.accounts', scopes: ['crm.account.read', 'crm.account.read-all'] },
  { path: '/crm/leads', label: 'crm.nav.leads', scopes: ['crm.lead.read', 'crm.lead.read-all'] },
  { path: '/crm/opportunities', label: 'crm.nav.opportunities', scopes: ['crm.opportunity.read', 'crm.opportunity.read-all'] },
  { path: '/crm/activities', label: 'crm.nav.activities', scopes: ['crm.activity.read', 'crm.activity.read-all'] },
  { path: '/crm/followups', label: 'crm.nav.followups', scopes: ['crm.followup.manage', 'crm.task.manage'] },
  { path: '/crm/analyses', label: 'crm.nav.analyses', scopes: ['crm.analysis.read', 'crm.analysis.manage'] },
  { path: '/crm/finance', label: 'crm.nav.finance', scopes: ['crm.credit.read', 'crm.contract.read'] },
  { path: '/crm/settings', label: 'crm.nav.settings', scopes: ['crm.settings.manage'] },
] as const
const available = computed(() => sections.filter(item => crmEnabled() && item.scopes.some(scope => auth.hasScope(scope))))
const enabled = computed(crmEnabled)
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6 p-3 text-[var(--dh-text)] sm:p-6" data-crm-landing>
    <header class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
      <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">CRM</p>
      <h1 class="mt-2 text-2xl font-black">{{ t('crm.title') }}</h1>
      <p class="mt-2 text-sm text-[var(--dh-text-muted)]">{{ t('commercial.crmDescription') }}</p>
    </header>
    <div v-if="!enabled" role="status" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <h2 class="font-bold">{{ t('commercial.integrationPending') }}</h2>
      <p class="mt-2 text-sm text-[var(--dh-text-muted)]">{{ t('commercial.crmPending') }}</p>
    </div>
    <div v-else-if="available.length === 0" role="status" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      {{ t('commercial.crmPermissions') }}
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink v-for="item in available" :key="item.path" :to="item.path"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 font-bold transition hover:border-[var(--dh-primary)]">
        {{ t(item.label) }}
      </RouterLink>
    </div>
    <p class="text-sm text-[var(--dh-text-muted)]">{{ t('commercial.crmScopeNote') }}</p>
  </section>
</template>
