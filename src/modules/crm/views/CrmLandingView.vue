<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import {
  Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarDays,
  CircleDollarSign, ContactRound, Settings2, ShieldCheck, UsersRound,
} from 'lucide-vue-next'
import { crmEnabled } from '../services/crmApi'

const { t, locale } = useI18n()
const auth = useAuthStore()
const enabled = computed(crmEnabled)
const sections = [
  { path: '/crm/accounts', label: 'crm.nav.accounts', icon: UsersRound, scopes: ['crm.account.read', 'crm.account.read-all'], descEs: 'Clientes y empresas registradas', descEn: 'Customers and registered businesses' },
  { path: '/crm/leads', label: 'crm.nav.leads', icon: ContactRound, scopes: ['crm.lead.read', 'crm.lead.read-all'], descEs: 'Captación y calificación comercial', descEn: 'Lead capture and qualification' },
  { path: '/crm/opportunities', label: 'crm.nav.opportunities', icon: BriefcaseBusiness, scopes: ['crm.opportunity.read', 'crm.opportunity.read-all'], descEs: 'Embudo, etapas y negociaciones', descEn: 'Pipeline, stages and negotiations' },
  { path: '/crm/activities', label: 'crm.nav.activities', icon: Activity, scopes: ['crm.activity.read', 'crm.activity.read-all'], descEs: 'Tareas y actividad comercial', descEn: 'Commercial activity and tasks' },
  { path: '/crm/followups', label: 'crm.nav.followups', icon: CalendarDays, scopes: ['crm.followup.manage', 'crm.task.manage'], descEs: 'Agenda y próximas gestiones', descEn: 'Calendar and upcoming work' },
  { path: '/crm/analyses', label: 'crm.nav.analyses', icon: BarChart3, scopes: ['crm.analysis.read', 'crm.analysis.manage'], descEs: 'Resultados e indicadores', descEn: 'Results and indicators' },
  { path: '/crm/finance', label: 'crm.nav.finance', icon: CircleDollarSign, scopes: ['crm.credit.read', 'crm.contract.read'], descEs: 'Límites, crédito y contratos', descEn: 'Credit limits and contracts' },
  { path: '/crm/settings', label: 'crm.nav.settings', icon: Settings2, scopes: ['crm.settings.manage'], descEs: 'Configuración y embudos comerciales', descEn: 'Sales pipelines and administration' },
] as const
const available = computed(() => sections.filter(item => enabled.value && item.scopes.some(scope => auth.hasScope(scope))))
const hasUserManagement = computed(() => auth.hasScope('auth.users.view'))
</script>

<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 text-[var(--dh-text)] sm:px-7 lg:py-8" data-crm-landing>
    <header class="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--dh-border)] pb-6">
      <div>
        <div class="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[var(--dh-text-muted)]">
          <span class="h-2 w-2 rounded-full bg-[var(--dh-primary)]" aria-hidden="true"></span>
          {{ t('crm.title') }}
        </div>
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ locale === 'en' ? 'Commercial workspace' : 'Centro de gestión comercial' }}</h1>
        <p class="mt-2 max-w-2xl text-sm text-[var(--dh-text-muted)]">{{ t('commercial.crmDescription') }}</p>
      </div>
      <RouterLink v-if="hasUserManagement" to="/auth/users"
        class="inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--dh-primary)]">
        <ShieldCheck class="h-4 w-4" />
        {{ locale === 'en' ? 'User permissions' : 'Permisos de usuarios' }}
        <ArrowUpRight class="h-4 w-4" />
      </RouterLink>
    </header>

    <div v-if="!enabled" role="alert" class="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
      {{ locale === 'en' ? 'CRM is disabled by configuration (VITE_CRM_ENABLED=false).' : 'CRM está deshabilitado explícitamente por configuración (VITE_CRM_ENABLED=false).' }}
    </div>
    <div v-else-if="available.length === 0" class="flex flex-col items-start gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
      <ShieldCheck class="h-7 w-7 text-[var(--dh-primary)]" />
      <h2 class="text-lg font-bold">{{ locale === 'en' ? 'No CRM access assigned' : 'Sin permisos comerciales asignados' }}</h2>
      <p class="max-w-2xl text-sm text-[var(--dh-text-muted)]">{{ t('commercial.crmPermissions') }}</p>
      <RouterLink v-if="hasUserManagement" to="/auth/users" class="text-sm font-bold text-[var(--dh-primary)]">
        {{ locale === 'en' ? 'Manage user access' : 'Administrar accesos por usuario' }}
      </RouterLink>
    </div>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold">{{ locale === 'en' ? 'Available modules' : 'Módulos disponibles' }}</h2>
        <span class="text-xs font-medium text-[var(--dh-text-muted)]">
          {{ available.length }} {{ locale === 'en' ? 'enabled by your permissions' : 'habilitados según tus permisos' }}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink v-for="item in available" :key="item.path" :to="item.path"
          class="group flex min-h-44 flex-col justify-between rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--dh-primary)] hover:shadow-lg"
        >
          <div class="flex items-center justify-between">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]">
              <component :is="item.icon" class="h-5 w-5" />
            </div>
            <ArrowUpRight class="h-4 w-4 text-[var(--dh-text-muted)] transition group-hover:text-[var(--dh-primary)]" />
          </div>
          <div>
            <h3 class="mt-4 font-bold">{{ t(item.label) }}</h3>
            <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ locale === 'en' ? item.descEn : item.descEs }}</p>
          </div>
        </RouterLink>
      </div>
      <div class="flex items-start gap-3 rounded-xl border border-[var(--dh-border)] px-4 py-3 text-xs text-[var(--dh-text-muted)]">
        <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ t('commercial.crmScopeNote') }} {{ locale === 'en' ? 'Permissions are revalidated in the API for every action.' : 'La API vuelve a validar los permisos en cada operación.' }}</span>
      </div>
    </template>
  </section>
</template>
