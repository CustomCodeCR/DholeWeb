<script setup lang="ts">
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  RefreshCw,
  Send,
  TimerOff,
  WalletCards,
  XCircle,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import type {
  PricingRateDashboardDto,
  PricingRateDashboardQuery,
  RateStatus,
} from '@/core/interfaces/pricing'
import { DhBadge, DhButton, DhInput, DhSpinner } from '@/shared/components/atoms'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const router = useRouter()
const toastStore = useToastStore()
const loading = ref(false)
const dashboard = ref<PricingRateDashboardDto | null>(null)

const filters = reactive({
  createdFrom: '',
  createdTo: '',
  modifiedFrom: '',
  modifiedTo: '',
  validityFrom: '',
  validityTo: '',
})

const statusCards = computed(() => {
  const data = dashboard.value
  if (!data) return []

  return [
    { label: 'Abiertas', value: data.openCount, status: 'Open' as RateStatus, icon: FileCheck2 },
    {
      label: 'Aprobadas',
      value: data.approvedCount,
      status: 'ApprovedByManagement' as RateStatus,
      icon: BadgeCheck,
    },
    {
      label: 'Rechazadas',
      value: data.rejectedCount,
      status: null as RateStatus | null,
      icon: XCircle,
    },
    {
      label: 'Solicitadas por cliente',
      value: data.requestedByClientCount,
      status: 'RequestedByClient' as RateStatus,
      icon: Send,
    },
    { label: 'Cerradas', value: data.closedCount, status: 'Closed' as RateStatus, icon: Ban },
    { label: 'Vencidas', value: data.expiredCount, status: 'Expired' as RateStatus, icon: TimerOff },
  ]
})

function buildQuery(): PricingRateDashboardQuery {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as PricingRateDashboardQuery
}

async function loadDashboard() {
  try {
    loading.value = true
    dashboard.value = await PricingService.getRateDashboard(buildQuery())
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el dashboard de Pricing.')
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  Object.assign(filters, {
    createdFrom: '',
    createdTo: '',
    modifiedFrom: '',
    modifiedTo: '',
    validityFrom: '',
    validityTo: '',
  })
  void loadDashboard()
}

function openStatus(status: RateStatus | null) {
  if (!status) return
  router.push({ path: '/pricing/rates', query: { status } })
}

function statusLabel(status: RateStatus) {
  return (
    {
      PendingApproval: 'Pendiente de autorización',
      ApprovedByManagement: 'Aprobada por gerencia',
      RejectedByManagement: 'Rechazada por gerencia',
      Open: 'Abierta',
      Sent: 'Enviada',
      AcceptedByClient: 'Aceptada por el cliente',
      RejectedByClient: 'Rechazada por el cliente',
      RequestedByClient: 'Solicitada por el cliente',
      Closed: 'Cerrada',
      Expired: 'Vencida',
    } satisfies Record<RateStatus, string>
  )[status]
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatDate(value)
  return new Intl.DateTimeFormat('es-CR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

onMounted(loadDashboard)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">Dashboard por rol</p>
        <h2 class="mt-2 text-2xl font-black text-[var(--dh-text)]">Pricing</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Estado comercial, vigencia y utilidad de las tarifas oficiales.
        </p>
      </div>
      <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="loading" @click="loadDashboard" />
    </div>

    <section class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-center gap-2">
        <CalendarClock class="h-5 w-5 text-[var(--dh-primary)]" />
        <h3 class="font-black text-[var(--dh-text)]">Filtros de fecha</h3>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div class="grid grid-cols-2 gap-2">
          <DhInput v-model="filters.createdFrom" type="date" label="Creada desde" />
          <DhInput v-model="filters.createdTo" type="date" label="Creada hasta" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <DhInput v-model="filters.modifiedFrom" type="date" label="Modificada desde" />
          <DhInput v-model="filters.modifiedTo" type="date" label="Modificada hasta" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <DhInput v-model="filters.validityFrom" type="date" label="Vigencia desde" />
          <DhInput v-model="filters.validityTo" type="date" label="Vigencia hasta" />
        </div>
      </div>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <DhButton label="Limpiar" variant="ghost" @click="clearFilters" />
        <DhButton label="Aplicar filtros" :loading="loading" @click="loadDashboard" />
      </div>
    </section>

    <div v-if="loading && !dashboard" class="flex min-h-48 items-center justify-center">
      <DhSpinner label="Cargando dashboard..." />
    </div>

    <template v-else-if="dashboard">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <button
          v-for="card in statusCards"
          :key="card.label"
          type="button"
          :disabled="!card.status"
          class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-[rgb(var(--dh-primary-rgb)/0.35)] enabled:hover:shadow-lg disabled:cursor-default"
          @click="openStatus(card.status)"
        >
          <div class="flex items-center justify-between gap-3">
            <component :is="card.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
            <span class="text-3xl font-black text-[var(--dh-text)]">{{ card.value }}</span>
          </div>
          <p class="mt-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">{{ card.label }}</p>
        </button>
      </div>

      <section class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="flex items-center gap-2">
            <CircleDollarSign class="h-5 w-5 text-[var(--dh-primary)]" />
            <div>
              <h3 class="font-black text-[var(--dh-text)]">Utilidad proyectada por moneda</h3>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Incluye tarifas aprobadas, abiertas, enviadas, solicitadas o aceptadas; excluye rechazadas, cerradas y vencidas.</p>
            </div>
          </div>
          <div v-if="dashboard.financials.length" class="mt-4 grid gap-3 md:grid-cols-2">
            <article
              v-for="financial in dashboard.financials"
              :key="financial.currencyId"
              class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ financial.currencyName }}</p>
                  <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ financial.currencyCode }}</p>
                </div>
                <DhBadge :label="`${financial.rateCount} tarifas`" variant="neutral" />
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p class="font-semibold text-[var(--dh-text-muted)]">Utilidad proyectada</p>
                  <p class="mt-1 text-xl font-black text-green-600 dark:text-green-400">
                    {{ formatMoney(financial.totalUtilityAmount, financial.currencyCode) }}
                  </p>
                </div>
                <div>
                  <p class="font-semibold text-[var(--dh-text-muted)]">Margen promedio</p>
                  <p class="mt-1 text-xl font-black text-[var(--dh-text)]">{{ financial.averageMarginPercentage.toFixed(2) }}%</p>
                </div>
                <div>
                  <p class="font-semibold text-[var(--dh-text-muted)]">Costo</p>
                  <p class="mt-1 font-black text-[var(--dh-text)]">{{ formatMoney(financial.totalCostAmount, financial.currencyCode) }}</p>
                </div>
                <div>
                  <p class="font-semibold text-[var(--dh-text-muted)]">Venta</p>
                  <p class="mt-1 font-black text-[var(--dh-text)]">{{ formatMoney(financial.totalSaleAmount, financial.currencyCode) }}</p>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="mt-4 rounded-[22px] border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
            No hay tarifas dentro de los filtros seleccionados.
          </p>
        </div>

        <div class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="flex items-center gap-2">
            <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
            <h3 class="font-black text-[var(--dh-text)]">Actividad</h3>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div class="rounded-[22px] bg-[var(--dh-input)] p-4">
              <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Total de tarifas</p>
              <p class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ dashboard.totalRates }}</p>
            </div>
            <div class="rounded-[22px] bg-[var(--dh-input)] p-4">
              <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Última creación</p>
              <p class="mt-2 font-black text-[var(--dh-text)]">{{ formatDateTime(dashboard.lastCreatedAtUtc) }}</p>
            </div>
            <div class="rounded-[22px] bg-[var(--dh-input)] p-4">
              <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Última modificación</p>
              <p class="mt-2 font-black text-[var(--dh-text)]">{{ formatDateTime(dashboard.lastModifiedAtUtc) }}</p>
            </div>
            <div class="rounded-[22px] bg-[var(--dh-input)] p-4">
              <p class="text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Pendientes de autorización</p>
              <p class="mt-2 text-3xl font-black text-yellow-600 dark:text-yellow-400">{{ dashboard.pendingApprovalCount }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--dh-border)] p-5">
          <div class="flex items-center gap-2">
            <WalletCards class="h-5 w-5 text-[var(--dh-primary)]" />
            <h3 class="font-black text-[var(--dh-text)]">Tarifas con actividad reciente</h3>
          </div>
          <DhButton label="Ver todas" variant="ghost" size="sm" @click="router.push('/pricing/rates')" />
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-[var(--dh-input)] text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
              <tr>
                <th class="px-5 py-3">Tarifa</th>
                <th class="px-5 py-3">Ruta</th>
                <th class="px-5 py-3">Estado</th>
                <th class="px-5 py-3">Creación / modificación</th>
                <th class="px-5 py-3">Vigencia</th>
                <th class="px-5 py-3 text-right">Utilidad proyectada</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr
                v-for="rate in dashboard.recentRates"
                :key="rate.id"
                class="cursor-pointer transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                @click="openStatus(rate.status)"
              >
                <td class="px-5 py-4">
                  <p class="font-black text-[var(--dh-text)]">{{ rate.rateCode }}</p>
                  <p class="mt-1 max-w-56 truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.clientName || rate.carrierName || 'Sin cliente' }}</p>
                </td>
                <td class="px-5 py-4 font-semibold text-[var(--dh-text)]">
                  {{ rate.polName }} → {{ rate.poeName }} → {{ rate.podName }}
                  <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ rate.containerTypeName }}</p>
                </td>
                <td class="px-5 py-4">
                  <DhBadge :label="statusLabel(rate.status)" :variant="statusTone(rate.status)" />
                </td>
                <td class="px-5 py-4 text-xs font-semibold text-[var(--dh-text-muted)]">
                  <p>Creada: {{ formatDateTime(rate.createdAtUtc) }}</p>
                  <p class="mt-1">Modificada: {{ formatDateTime(rate.updatedAtUtc) }}</p>
                </td>
                <td class="px-5 py-4 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}
                </td>
                <td class="px-5 py-4 text-right font-black text-green-600 dark:text-green-400">
                  {{ formatMoney(rate.totalUtilityAmount, rate.currencyCode) }}
                </td>
              </tr>
              <tr v-if="!dashboard.recentRates.length">
                <td colspan="6" class="px-5 py-10 text-center font-semibold text-[var(--dh-text-muted)]">No hay tarifas para mostrar.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
