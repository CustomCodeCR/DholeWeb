<script setup lang="ts">
import CrmModuleNavigation from '../components/CrmModuleNavigation.vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import {
  Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarDays,
  CircleDollarSign, ContactRound, Settings2, ShieldCheck, UsersRound,
} from 'lucide-vue-next'
import { crmEnabled, crmList, type CrmRow } from '../services/crmApi'
import { DhPageHeader } from '@/shared/components/organisms'

const { t, locale } = useI18n()
const auth = useAuthStore()
const enabled = computed(crmEnabled)
const sections = [
  { path: '/crm/accounts', label: 'crm.nav.accounts', icon: UsersRound, scopes: ['crm.account.read', 'crm.account.read-all'], descEs: 'Clientes y empresas registradas', descEn: 'Customers and registered businesses' },
  { path: '/crm/contacts', label: 'crm.nav.contacts', icon: ContactRound, scopes: ['crm.contact.read'], descEs: 'Personas, cuentas relacionadas y medios de contacto', descEn: 'People, linked accounts and communication' },
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
type CountKey = 'accounts' | 'leads' | 'opportunities' | 'activities'
const counts = ref<Record<CountKey, number | null>>({
  accounts: null, leads: null, opportunities: null, activities: null,
})
const lastActivities = ref<CrmRow[]>([])
const availableAccounts = ref<CrmRow[]>([])
const homeLoading = ref(false)
const homeError = ref('')
const quickStats = computed(() => [
  { key: 'accounts' as const, title: locale.value === 'en' ? 'Customers' : 'Cuentas', icon: UsersRound, path: '/crm/accounts' },
  { key: 'leads' as const, title: locale.value === 'en' ? 'Leads' : 'Prospectos', icon: ContactRound, path: '/crm/leads' },
  { key: 'opportunities' as const, title: locale.value === 'en' ? 'Opportunities' : 'Oportunidades', icon: BriefcaseBusiness, path: '/crm/opportunities' },
  { key: 'activities' as const, title: locale.value === 'en' ? 'Activities' : 'Actividades', icon: Activity, path: '/crm/activities' },
].filter(metric => available.value.some(section => section.path === metric.path)))
async function loadHomeSummary() {
  if (!enabled.value) return
  homeLoading.value = true
  homeError.value = ''
  const queries = [
    { key: 'accounts' as CountKey, scopes: ['crm.account.read', 'crm.account.read-all'] },
    { key: 'leads' as CountKey, scopes: ['crm.lead.read', 'crm.lead.read-all'] },
    { key: 'opportunities' as CountKey, scopes: ['crm.opportunity.read', 'crm.opportunity.read-all'] },
    { key: 'activities' as CountKey, scopes: ['crm.activity.read', 'crm.activity.read-all'] },
  ].filter(item => item.scopes.some(scope => auth.hasScope(scope)))
  const response = await Promise.allSettled(queries.map(async item => ({
    key: item.key,
    data: await crmList(item.key, { page: 1, pageSize: 5 }),
  })))
  for (const result of response) {
    if (result.status === 'fulfilled') {
      counts.value[result.value.key] = result.value.data.total
      if (result.value.key === 'accounts') availableAccounts.value = result.value.data.items
      if (result.value.key === 'activities') lastActivities.value = result.value.data.items
    } else homeError.value = locale.value === 'en' ? 'Some indicators are unavailable.' : 'Algunos indicadores no están disponibles.'
  }
  homeLoading.value = false
}
onMounted(loadHomeSummary)

const navigationGroups = computed(() => [
  { name: locale.value === 'en' ? 'Customers' : 'Clientes', paths: ['/crm/accounts','/crm/contacts'] },
  { name: locale.value === 'en' ? 'Sales' : 'Ventas', paths: ['/crm/leads','/crm/opportunities'] },
  { name: locale.value === 'en' ? 'Activities' : 'Actividades', paths: ['/crm/activities','/crm/followups'] },
  { name: locale.value === 'en' ? 'Commercial management' : 'Gestión comercial', paths: ['/crm/analyses','/crm/finance','/crm/settings'] },
].map(group => ({ ...group, pages: available.value.filter(item => group.paths.includes(item.path)) }))
  .filter(group => group.pages.length > 0))
</script>

<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 text-[var(--dh-text)] sm:px-7 lg:py-8" data-crm-landing>
    <DhPageHeader :title="locale === 'en' ? 'Commercial workspace' : 'Centro de gestión comercial'"
      :subtitle="t('commercial.crmDescription')" :icon="BriefcaseBusiness" hide-excel-export>
      <template #actions>
        <RouterLink v-if="hasUserManagement" to="/auth/users"
          class="inline-flex min-h-11 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-2 text-sm font-bold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] transition hover:bg-[var(--dh-card-hover)]">
          <ShieldCheck class="h-4 w-4" />
          {{ locale === 'en' ? 'User permissions' : 'Permisos de usuarios' }}
          <ArrowUpRight class="h-4 w-4" />
        </RouterLink>
      </template>
    </DhPageHeader>

    <div v-if="!enabled" role="alert" class="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
    <CrmModuleNavigation />
      {{ locale === 'en' ? 'CRM is not active. Enable it with VITE_CRM_ENABLED=true only after the commercial HTTP APIs are deployed.' : 'CRM no está activo. Use VITE_CRM_ENABLED=true únicamente cuando las APIs HTTP comerciales estén desplegadas.' }}
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
      <section v-if="quickStats.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink v-for="stat in quickStats" :key="stat.key" :to="stat.path"
          class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 transition hover:border-[var(--dh-primary)]">
          <div>
            <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ stat.title }}</p>
            <p class="mt-2 text-2xl font-extrabold">{{ counts[stat.key] ?? (homeLoading ? '…' : '—') }}</p>
            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">Registros autorizados</p>
          </div>
          <component :is="stat.icon" class="h-6 w-6 text-[var(--dh-primary)]" />
        </RouterLink>
      </section>
      <p v-if="homeError" role="status" class="text-xs text-amber-600">{{ homeError }}</p>
      <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(270px,.7fr)]">
        <div class="space-y-4">
          <section v-for="group in navigationGroups" :key="group.name" class="overflow-hidden rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
            <div class="flex items-center justify-between border-b border-[var(--dh-border)] px-4 py-3">
              <h2 class="text-xs font-extrabold uppercase tracking-wider">{{ group.name }}</h2>
              <span class="text-[11px] text-[var(--dh-text-muted)]">{{ group.pages.length }} secciones</span>
            </div>
            <RouterLink v-for="item in group.pages" :key="item.path" :to="item.path"
              class="group flex items-center gap-3 border-b border-[var(--dh-border)] px-4 py-3.5 transition last:border-0 hover:bg-[var(--dh-card-hover)]">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]"><component :is="item.icon" class="h-4 w-4" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold">{{ t(item.label) }}</span>
                <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ locale === 'en' ? item.descEn : item.descEs }}</span>
              </span>
              <ArrowUpRight class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] group-hover:text-[var(--dh-primary)]" />
            </RouterLink>
          </section>
        </div>
        <aside class="space-y-3">
          <section v-if="lastActivities.length" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-extrabold"><Activity class="h-4 w-4 text-[var(--dh-primary)]" />Actividad reciente</h2>
            <RouterLink v-for="activity in lastActivities" :key="activity.id" :to="'/crm/activities/' + encodeURIComponent(activity.id)"
              class="block border-b border-[var(--dh-border)] py-3 last:border-0 hover:text-[var(--dh-primary)]">
              <p class="truncate text-xs font-bold">{{ activity.subject || 'Actividad' }}</p>
              <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ activity.type }} · {{ activity.status }}</p>
            </RouterLink>
          </section>
          <section v-if="availableAccounts.length" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-extrabold"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />Acceso a clientes</h2>
            <RouterLink v-for="account in availableAccounts" :key="account.id" :to="'/crm/accounts/' + encodeURIComponent(account.id)"
              class="block truncate border-b border-[var(--dh-border)] py-2.5 text-xs font-semibold last:border-0 hover:text-[var(--dh-primary)]">
              {{ account.displayName || account.legalName }}
            </RouterLink>
          </section>
          <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <h2 class="text-sm font-extrabold">Centro de ventas</h2>
            <p class="mt-2 text-xs leading-relaxed text-[var(--dh-text-muted)]">
              Consultá cuentas, personas de contacto, oportunidades, tarifas vinculadas, rutas habituales y seguimientos.
              Cada ficha reúne registros relacionados en una sola pantalla.
            </p>
            <RouterLink v-if="available.some(x => x.path === '/crm/accounts')" to="/crm/accounts"
              class="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--dh-primary)]">
              Abrir cuentas <ArrowUpRight class="h-4 w-4" />
            </RouterLink>
          </section>
          <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <h2 class="text-sm font-extrabold">Resumen e indicadores</h2>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
              Los indicadores del CRM se calculan con los registros visibles según tus permisos, sin valores simulados.
            </p>
            <RouterLink to="/crm/dashboard" class="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--dh-primary)]">
              Abrir panel comercial <ArrowUpRight class="h-4 w-4" />
            </RouterLink>
          </section>
        </aside>
      </div>
      <div class="flex items-start gap-3 rounded-xl border border-[var(--dh-border)] px-4 py-3 text-xs text-[var(--dh-text-muted)]">
        <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ t('commercial.crmScopeNote') }} {{ locale === 'en' ? 'Permissions are revalidated in the API for every action.' : 'La API vuelve a validar los permisos en cada operación.' }}</span>
      </div>
    </template>
  </section>
</template>
