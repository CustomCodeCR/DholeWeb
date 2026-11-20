<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import PricingExpiredRateApprovalModal from '@/modules/pricing/components/PricingExpiredRateApprovalModal.vue'
import { expiredRateApprovalService } from '@/modules/pricing/services/expiredRateApprovalService'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import OperationsRoleDashboard from '@/modules/dashboard/components/OperationsRoleDashboard.vue'
import PricingRoleDashboard from '@/modules/dashboard/components/PricingRoleDashboard.vue'
import SellerRoleDashboard from '@/modules/dashboard/components/SellerRoleDashboard.vue'
import RateOperationalReportsPanel from '@/modules/dashboard/components/RateOperationalReportsPanel.vue'
import PricingRateRequestsPanel from '@/modules/pricing/components/PricingRateRequestsPanel.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const route = useRoute()
const modalStore = useModalStore()
const toastStore = useToastStore()

// Approval belongs to the authenticated identity, not a Pricing role.
const expiredRateApprovers = ['rsibaja@castrofallas.com', 'jmesen@castrofallas.com']
const canApproveExpiredRates = computed(() =>
  expiredRateApprovers.includes(String(authStore.email ?? '').trim().toLowerCase()),
)
const pendingExpiredApprovals = ref(0)
const expiredApprovalCountLoading = ref(false)

async function reloadExpiredApprovals() {
  if (!canApproveExpiredRates.value) return
  expiredApprovalCountLoading.value = true
  try {
    pendingExpiredApprovals.value = (await expiredRateApprovalService.pending()).length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las autorizaciones de tarifas vencidas.')
  } finally {
    expiredApprovalCountLoading.value = false
  }
}

function openExpiredApprovalInbox() {
  if (!canApproveExpiredRates.value) return
  modalStore.open({
    title: 'Solicitudes de autorización de tarifas vencidas',
    component: PricingExpiredRateApprovalModal,
    size: 'xl',
    surface: 'solid',
    props: { mode: 'review', onSaved: reloadExpiredApprovals },
  })
}

function onExpiredApprovalNotification(event: Event) {
  const notification = (event as CustomEvent<{ notificationType?: string }>).detail
  if (notification?.notificationType?.startsWith('pricing.rate.expired-update.')) {
    void reloadExpiredApprovals()
  }
}

onMounted(() => {
  if (canApproveExpiredRates.value) void reloadExpiredApprovals()
  window.addEventListener('dhole:notification:received', onExpiredApprovalNotification)
})
onBeforeUnmount(() => window.removeEventListener('dhole:notification:received', onExpiredApprovalNotification))
watch(
  () => route.query.expiredApprovals,
  (value) => {
    if (value === '1' && canApproveExpiredRates.value) openExpiredApprovalInbox()
  },
  { immediate: true },
)

function localDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
const globalFilters = reactive({
  from: localDate(new Date(Date.now() - 89 * 86_400_000)),
  to: localDate(new Date()),
  seller: '',
  mode: '',
})
const appliedFrom = ref(globalFilters.from)
const appliedTo = ref(globalFilters.to)
const sellerDashboardOptions = ref<Array<{ value: string; label: string }>>([])
const sellerReportOptions = ref<Array<{ value: string; label: string }>>([])
const dashboardModes = ref<Array<{ value: string; label: string }>>([])
const reportModes = ref<Array<{ value: string; label: string }>>([])
const globalDateError = computed(() => globalFilters.from && globalFilters.to && globalFilters.from > globalFilters.to)
function applyGlobalDates() {
  if (globalDateError.value) return
  appliedFrom.value = globalFilters.from
  appliedTo.value = globalFilters.to
}
function setSellerOptions(value: { sellers: Array<{ value: string; label: string }>; modes: Array<{ value: string; label: string }> }) {
  sellerDashboardOptions.value = value.sellers
  dashboardModes.value = value.modes
}
function setReportOptions(value: { sellers: Array<{ value: string; label: string }>; modes: Array<{ value: string; label: string }> }) {
  sellerReportOptions.value = value.sellers
  reportModes.value = value.modes
}
function mergeFilterOptions(...sources: Array<Array<{ value: string; label: string }>>) {
  const entries = new Map<string, string>()
  for (const source of sources) for (const option of source) {
    if (option.value) entries.set(option.value, option.label)
  }
  return [...entries].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }))
}
const globalSellerOptions = computed(() => [
  { value: '', label: 'Todos los vendedores' },
  ...mergeFilterOptions(sellerDashboardOptions.value, sellerReportOptions.value),
])
const globalModeOptions = computed(() => [
  { value: '', label: 'Todas las modalidades' },
  ...mergeFilterOptions(dashboardModes.value, reportModes.value),
])

function isSuperUser(): boolean {
  return (
    authStore.hasRole('SuperUsuario') ||
    authStore.hasRole('SuperUser') ||
    authStore.hasRole('superusuario')
  )
}

const hasPricingOperatorAccess = computed(() =>
  authStore.hasScope(PRICING_SCOPES.rates.create)
  || authStore.hasScope(PRICING_SCOPES.rates.update)
  || authStore.hasScope(PRICING_SCOPES.rates.delete)
  || authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin)
  || authStore.hasScope(PRICING_SCOPES.rates.approveFreight)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.review)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.approve)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.reject)
  || authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)

const canViewAllCommercialRates = computed(() =>
  authStore.hasScope('pricing.rate-request.view-all'),
)

// Un usuario puede tener Pricing y Vendedor a la vez. No perder la capacidad de
// visualizar el dashboard comercial al calcular el dashboard predeterminado.
const hasSellerRole = computed(() => authStore.roles.some((role) => {
  const value = role.trim().toLowerCase()
  return value === 'vendedor'
    || value === 'seller'
    || value === 'ventas'
    || value.includes('vendedor')
    || value.includes('seller')
}))

const isSellerUser = computed(() => {
  const sellerCapability = hasSellerRole.value || authStore.hasScope('pricing.rate-request.create')
  return sellerCapability && !hasPricingOperatorAccess.value && !canViewAllCommercialRates.value
})

// Navigation to Pricing is not permission to read the management dashboard.
// Seller sessions can use the workspace but must not access the restricted
// rates/dashboard endpoint unless they also have operator permissions.
const hasSellerDashboardAccess = computed(() =>
  hasSellerRole.value
  || authStore.hasScope('pricing.rate-request.create')
  || canViewAllCommercialRates.value,
)

const canUsePricing = computed(() =>
  isSuperUser()
  || (
    authStore.hasScope(PRICING_SCOPES.rates.view)
    && (!hasSellerDashboardAccess.value || hasPricingOperatorAccess.value)
  ),
)

const canManageSellerRequests = computed(() =>
  !isSellerUser.value && authStore.hasScope(PRICING_SCOPES.rates.update),
)

// El selector altera sólo la vista; nunca cambia la sesión ni sus permisos.
// Pricing + Vendedor puede alternar, aunque no tenga el rol SuperUsuario.
type DashboardRole = 'pricing' | 'seller' | 'operations'
const selectedDashboardRole = ref<DashboardRole>('pricing')
const canUseOperations = computed(() => authStore.hasScope('operations.case.read'))
const dashboardRoleOptions = computed(() => [
  ...(canUsePricing.value ? [{ value: 'pricing', label: 'Pricing' }] : []),
  ...(hasSellerDashboardAccess.value ? [{ value: 'seller', label: t('dashboard.seller') }] : []),
  ...(canUseOperations.value ? [{ value: 'operations', label: t('operations.title') }] : []),
])
function selectDashboardRole(value: string | number) {
  if (value === 'pricing' && canUsePricing.value) selectedDashboardRole.value = 'pricing'
  else if (value === 'seller' && hasSellerDashboardAccess.value) selectedDashboardRole.value = 'seller'
  else if (value === 'operations' && canUseOperations.value) selectedDashboardRole.value = 'operations'
}
const canSelectDashboard = computed(() =>
  isSuperUser() || [canUsePricing.value, hasSellerDashboardAccess.value, canUseOperations.value].filter(Boolean).length > 1,
)
const activeDashboardRole = computed<DashboardRole>(() => {
  // Also correct the dashboard when the same page is reused for impersonation.
  if (!canUsePricing.value && hasSellerDashboardAccess.value && !canUseOperations.value) return 'seller'
  if (!canUsePricing.value && !hasSellerDashboardAccess.value && canUseOperations.value) return 'operations'
  if (canSelectDashboard.value) {
    if (selectedDashboardRole.value === 'operations' && canUseOperations.value) return 'operations'
    if (selectedDashboardRole.value === 'seller' && hasSellerDashboardAccess.value) return 'seller'
    if (selectedDashboardRole.value === 'pricing' && canUsePricing.value) return 'pricing'
  }
  if (canUsePricing.value) return 'pricing'
  if (hasSellerDashboardAccess.value) return 'seller'
  return 'operations'
})
</script>

<template>
  <section class="space-y-6">
    <section v-if="activeDashboardRole !== 'operations'" class="dh-glass dh-liquid rounded-3xl px-5 py-5 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">
            {{ t('dashboard.welcome') }}
          </p>
          <h1 class="mt-1 break-words text-2xl font-black tracking-tight text-[var(--dh-text)] md:text-3xl">
            {{ authStore.userDisplayName || t('dashboard.operator') }}
          </h1>
        </div>
        <div v-if="canSelectDashboard" class="w-full shrink-0 sm:w-56">
          <label for="role-dashboard-selector" class="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ t('dashboard.roleDashboard') }}
          </label>
          <div class="relative">
            <select
              id="role-dashboard-selector"
              v-model="selectedDashboardRole"
              class="w-full appearance-none rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] py-2.5 pl-3.5 pr-10 text-sm font-bold text-[var(--dh-text)] outline-none transition hover:border-[var(--dh-primary)] focus:border-[var(--dh-primary)] focus:ring-2 focus:ring-[rgb(var(--dh-primary-rgb)/0.2)]"
            >
              <option v-if="canUsePricing" value="pricing">Pricing</option>
              <option v-if="hasSellerDashboardAccess" value="seller">{{ t('dashboard.seller') }}</option>
              <option v-if="canUseOperations" value="operations">{{ t('operations.title') }}</option>
            </select>
            <ChevronDown aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="canApproveExpiredRates"
      class="rounded-[24px] border border-amber-500/30 bg-[var(--dh-card)] p-4 sm:p-5"
      aria-label="Autorizaciones pendientes de tarifas vencidas"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-black text-[var(--dh-text)]">Autorizaciones de tarifas vencidas</h2>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
            <strong>{{ pendingExpiredApprovals }}</strong>
            solicitud{{ pendingExpiredApprovals === 1 ? '' : 'es' }} pendiente{{ pendingExpiredApprovals === 1 ? '' : 's' }} de revisión.
            Esta bandeja es independiente de los permisos de Pricing.
          </p>
        </div>
        <DhButton
          label="Revisar solicitudes"
          :loading="expiredApprovalCountLoading"
          @click="openExpiredApprovalInbox"
        />
      </div>
    </section>

    <section v-if="activeDashboardRole === 'seller'" class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5" aria-label="Filtros generales del dashboard">
      <div class="mb-3">
        <h2 class="text-sm font-black text-[var(--dh-text)]">Filtros generales del dashboard</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Se aplican a los indicadores comerciales, las tarifas, solicitudes y la reportería.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DhInput v-model="globalFilters.from" type="date" label="Solicitadas desde" />
        <DhInput v-model="globalFilters.to" type="date" label="Solicitadas hasta" />
        <DhSelect
          v-if="isSuperUser() || canViewAllCommercialRates"
          v-model="globalFilters.seller"
          label="Vendedor"
          placeholder=""
          :options="globalSellerOptions"
        />
        <DhSelect v-model="globalFilters.mode" label="Modalidad" placeholder="" :options="globalModeOptions" />
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p :class="globalDateError ? 'text-red-500' : 'text-[var(--dh-text-muted)]'" class="text-xs">
          {{ globalDateError ? 'La fecha inicial no puede ser posterior a la final.' : 'Los cambios de vendedor y modalidad son inmediatos; aplique las fechas para actualizar el período.' }}
        </p>
        <DhButton label="Aplicar fechas" size="sm" :disabled="Boolean(globalDateError)" @click="applyGlobalDates" />
      </div>
    </section>

    <!-- SuperUsuario supervisa globalmente y puede operar lo propio. Un usuario
         Pricing + Vendedor consulta sus propias tarifas, no las de terceros. -->
    <OperationsRoleDashboard v-if="activeDashboardRole === 'operations' && canUseOperations">
      <template #role-selector>
        <div v-if="canSelectDashboard" class="w-full sm:max-w-[200px]">
          <DhSelect
            :model-value="activeDashboardRole"
            :label="t('dashboard.roleDashboard')"
            :options="dashboardRoleOptions"
            :placeholder="''"
            @update:model-value="selectDashboardRole"
          />
        </div>
      </template>
    </OperationsRoleDashboard>

    <SellerRoleDashboard
      v-else-if="activeDashboardRole === 'seller'"
      :admin-preview="isSuperUser() || (canViewAllCommercialRates && !canSelectDashboard)"
      :enable-seller-actions="authStore.hasScope('pricing.rate-request.create')"
      :filter-from="appliedFrom"
      :filter-to="appliedTo"
      :filter-seller="globalFilters.seller"
      :filter-mode="globalFilters.mode"
      @filter-options="setSellerOptions"
    />

    <template v-else-if="canUsePricing">
      <PricingRateRequestsPanel v-if="canManageSellerRequests" />
      <PricingRoleDashboard />
    </template>

    <RateOperationalReportsPanel
      v-if="(activeDashboardRole === 'seller' && hasSellerDashboardAccess) || (activeDashboardRole === 'pricing' && canUsePricing)"
      :key="activeDashboardRole"
      :role="activeDashboardRole"
      :filter-from="appliedFrom"
      :filter-to="appliedTo"
      :filter-seller="globalFilters.seller"
      :filter-mode="globalFilters.mode"
      @filter-options="setReportOptions"
    />
  </section>
</template>
