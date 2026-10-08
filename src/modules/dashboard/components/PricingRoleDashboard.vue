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
import { UsersService } from '@/core/services/usersService'
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
const creatorDirectory = ref<Record<string, { displayName: string; userName: string }>>({})

async function loadCreatorDirectory() {
  try {
    const users = await UsersService.browse({ pageNumber: 1, pageSize: 200 })
    creatorDirectory.value = Object.fromEntries(
      users.map((user) => [user.id, { displayName: user.displayName, userName: user.userName }]),
    )
  } catch {
    // Algunos perfiles de Pricing no tienen permiso para consultar usuarios de Auth.
    // En ese caso se conserva el identificador del creador devuelto por Pricing.
    creatorDirectory.value = {}
  }
}

function creatorDisplayName(rate: PricingRateDashboardDto['recentRates'][number]) {
  if (rate.createdByDisplayName) return rate.createdByDisplayName
  if (rate.createdByUserName) return rate.createdByUserName
  if (rate.createdByUserId) {
    const user = creatorDirectory.value[rate.createdByUserId]
    return user?.displayName || user?.userName || rate.createdByUserId
  }
  return '—'
}

function creatorUserName(rate: PricingRateDashboardDto['recentRates'][number]) {
  if (rate.createdByUserName) return rate.createdByUserName
  if (!rate.createdByUserId) return ''
  return creatorDirectory.value[rate.createdByUserId]?.userName || ''
}

const filters = reactive({
  createdFrom: '',
  createdTo: '',
  modifiedFrom: '',
  modifiedTo: '',
  validityFrom: '',
  validityTo: '',
})
const filtersOpen = ref(false)
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length)

const statusCards = computed(() => {
  const data = dashboard.value
  if (!data) return []

  return [
    { label: 'Abiertas', value: data.openCount, status: 'Open' as RateStatus, icon: FileCheck2 },
    { label: 'Enviadas', value: data.sentCount, status: 'Sent' as RateStatus, icon: Send },
    { label: 'Vencidas', value: data.expiredCount, status: 'Expired' as RateStatus, icon: TimerOff },
    { label: 'Aceptadas', value: data.acceptedByClientCount, status: 'AcceptedByClient' as RateStatus, icon: BadgeCheck },
    { label: 'No aceptadas', value: data.rejectedCount, status: 'RejectedByClient' as RateStatus, icon: XCircle },
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
    await loadCreatorDirectory()
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

function commercialStatus(status: RateStatus): RateStatus {
  if (['PendingApproval', 'ApprovedByManagement', 'RejectedByManagement', 'RequestedByClient', 'Open'].includes(status)) return 'Open'
  if (status === 'Closed' || status === 'RejectedByClient') return 'RejectedByClient'
  return status
}

function openStatus(status: RateStatus | null) {
  if (!status) return
  router.push({ path: '/pricing/rates', query: { status: commercialStatus(status) } })
}

function openRate(rateId: string) {
  router.push({
    name: 'pricing-rate-wizard',
    params: { rateId },
    query: { mode: 'view' },
  })
}

function statusLabel(status: RateStatus) {
  return (
    {
      Open: 'Abierta',
      Sent: 'Enviada',
      Expired: 'Vencida',
      AcceptedByClient: 'Aceptada',
      RejectedByClient: 'No aceptada',
    } as Record<string, string>
  )[commercialStatus(status)] ?? 'Abierta'
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

function currencyDisplayValue(currencyCode?: string | null) {
  if (!currencyCode) return '—'

  const summary = dashboard.value?.financials.find(
    (financial) => financial.currencyCode === currencyCode,
  )

  return summary?.currencyName || currencyCode
}

onMounted(loadDashboard)
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">Dashboard por rol</p>
        <h2 class="mt-1 text-2xl font-black text-[var(--dh-text)]">Pricing</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Estado comercial, vigencia y utilidad de las tarifas oficiales.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <DhButton
          :label="`Filtros${activeFilterCount ? ` (${activeFilterCount})` : ''}`"
          :icon="CalendarClock"
          variant="secondary"
          @click="filtersOpen = !filtersOpen"
        />
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="loadDashboard"
        />
      </div>
    </div>

    <section
      v-if="filtersOpen"
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:rounded-[28px]"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <CalendarClock class="h-5 w-5 text-[var(--dh-primary)]" />
          <div>
            <h3 class="font-black text-[var(--dh-text)]">Filtros de fecha</h3>
            <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
              Limite el dashboard por creación, modificación o vigencia.
            </p>
          </div>
        </div>
        <DhBadge v-if="activeFilterCount" :label="`${activeFilterCount} activos`" variant="primary" />
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-3">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DhInput v-model="filters.createdFrom" type="date" label="Creada desde" />
          <DhInput v-model="filters.createdTo" type="date" label="Creada hasta" />
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DhInput v-model="filters.modifiedFrom" type="date" label="Modificada desde" />
          <DhInput v-model="filters.modifiedTo" type="date" label="Modificada hasta" />
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DhInput v-model="filters.validityFrom" type="date" label="Vigencia desde" />
          <DhInput v-model="filters.validityTo" type="date" label="Vigencia hasta" />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" />
        <DhButton label="Aplicar filtros" size="sm" :loading="loading" @click="loadDashboard" />
      </div>
    </section>

    <div v-if="loading && !dashboard" class="flex min-h-48 items-center justify-center">
      <DhSpinner label="Cargando dashboard..." />
    </div>

    <template v-else-if="dashboard">
      <div class="grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3">
        <button
          v-for="card in statusCards"
          :key="card.label"
          type="button"
          :disabled="!card.status"
          class="group min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-[rgb(var(--dh-primary-rgb)/0.35)] enabled:hover:shadow-lg last:col-span-2 lg:last:col-span-1"
          @click="openStatus(card.status)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
              <component :is="card.icon" class="h-4.5 w-4.5" />
            </span>
            <span class="text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ card.value }}</span>
          </div>
          <p class="mt-2 truncate text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
            {{ card.label }}
          </p>
        </button>
      </div>

      <section class="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <div class="min-w-0 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-start gap-2">
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
              <CircleDollarSign class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <h3 class="font-black text-[var(--dh-text)]">Utilidad proyectada por moneda</h3>
              <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
                Abiertas, enviadas y aceptadas. Excluye no aceptadas y vencidas.
              </p>
            </div>
          </div>

          <div
            v-if="dashboard.financials.length"
            class="mt-3 grid gap-3"
            :class="dashboard.financials.length > 1 ? '2xl:grid-cols-2' : 'grid-cols-1'"
          >
            <article
              v-for="financial in dashboard.financials"
              :key="financial.currencyId"
              class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3.5"
            >
              <div class="flex min-w-0 items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Moneda</p>
                  <p class="mt-0.5 truncate text-lg font-black text-[var(--dh-text)]">{{ financial.currencyName }}</p>
                </div>
                <DhBadge class="shrink-0" :label="`${financial.rateCount} tarifas`" variant="neutral" />
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-2">
                <div class="min-w-0 rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Utilidad</p>
                  <p class="mt-1 truncate text-base font-black text-green-600 dark:text-green-400">
                    {{ formatMoney(financial.totalUtilityAmount, financial.currencyName) }}
                  </p>
                </div>
                <div class="min-w-0 rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Margen</p>
                  <p class="mt-1 text-base font-black text-[var(--dh-text)]">{{ financial.averageMarginPercentage.toFixed(2) }}%</p>
                </div>
                <div class="min-w-0 rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Costo</p>
                  <p class="mt-1 truncate text-sm font-black text-[var(--dh-text)]">{{ formatMoney(financial.totalCostAmount, financial.currencyName) }}</p>
                </div>
                <div class="min-w-0 rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Venta</p>
                  <p class="mt-1 truncate text-sm font-black text-[var(--dh-text)]">{{ formatMoney(financial.totalSaleAmount, financial.currencyName) }}</p>
                </div>
              </div>
            </article>
          </div>

          <p
            v-else
            class="mt-3 rounded-[18px] border border-dashed border-[var(--dh-border)] p-5 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
          >
            No hay tarifas dentro de los filtros seleccionados.
          </p>
        </div>

        <div class="min-w-0 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
              <Clock3 class="h-5 w-5" />
            </span>
            <h3 class="font-black text-[var(--dh-text)]">Actividad</h3>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="rounded-[18px] bg-[var(--dh-input)] p-3">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Total de tarifas</p>
              <p class="mt-1.5 text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ dashboard.totalRates }}</p>
            </div>
            <div class="rounded-[18px] bg-[var(--dh-input)] p-3">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Abiertas</p>
              <p class="mt-1.5 text-2xl font-black tabular-nums text-yellow-600 dark:text-yellow-400">{{ dashboard.openCount }}</p>
            </div>
            <div class="rounded-[18px] bg-[var(--dh-input)] p-3">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Última creación</p>
              <p class="mt-1.5 text-xs font-black leading-5 text-[var(--dh-text)]">{{ formatDateTime(dashboard.lastCreatedAtUtc) }}</p>
            </div>
            <div class="rounded-[18px] bg-[var(--dh-input)] p-3">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Última modificación</p>
              <p class="mt-1.5 text-xs font-black leading-5 text-[var(--dh-text)]">{{ formatDateTime(dashboard.lastModifiedAtUtc) }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3.5">
          <div class="flex min-w-0 items-center gap-2">
            <WalletCards class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
            <div class="min-w-0">
              <h3 class="truncate font-black text-[var(--dh-text)]">Tarifas con actividad reciente</h3>
              <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
                Últimas tarifas creadas o modificadas.
              </p>
            </div>
          </div>
          <DhButton label="Ver todas" variant="ghost" size="sm" @click="router.push('/pricing/rates')" />
        </div>

        <div class="grid gap-2.5 p-3 lg:hidden">
          <button
            v-for="rate in dashboard.recentRates"
            :key="`mobile:${rate.id}`"
            type="button"
            class="min-w-0 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-left transition active:scale-[0.995]"
            @click="openRate(rate.id)"
          >
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="break-all text-xs font-black text-[var(--dh-text)]">{{ rate.rateCode }}</p>
                <p class="mt-1 truncate text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ rate.clientName || rate.carrierName || 'Sin cliente' }}
                </p>
              </div>
              <DhBadge class="shrink-0" :label="statusLabel(rate.status)" :variant="statusTone(rate.status)" />
            </div>

            <p class="mt-3 break-words text-sm font-black leading-5 text-[var(--dh-text)]">
              {{ rate.polName }} → {{ rate.poeName }} → {{ rate.podName }}
            </p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.containerTypeName }}</p>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-xl bg-[var(--dh-input)] p-2.5">
                <p class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Cotizado por</p>
                <p class="mt-1 truncate font-black text-[var(--dh-text)]">{{ creatorDisplayName(rate) }}</p>
              </div>
              <div class="rounded-xl bg-[var(--dh-input)] p-2.5">
                <p class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Utilidad</p>
                <p class="mt-1 truncate font-black text-green-600 dark:text-green-400">
                  {{ formatMoney(rate.totalUtilityAmount, currencyDisplayValue(rate.currencyCode)) }}
                </p>
              </div>
              <div class="rounded-xl bg-[var(--dh-input)] p-2.5">
                <p class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Modificada</p>
                <p class="mt-1 font-semibold text-[var(--dh-text)]">{{ formatDateTime(rate.updatedAtUtc) }}</p>
              </div>
              <div class="rounded-xl bg-[var(--dh-input)] p-2.5">
                <p class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Vigencia</p>
                <p class="mt-1 font-semibold text-[var(--dh-text)]">{{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</p>
              </div>
            </div>
          </button>

          <p
            v-if="!dashboard.recentRates.length"
            class="rounded-[18px] border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
          >
            No hay tarifas para mostrar.
          </p>
        </div>

        <div class="hidden overflow-x-auto lg:block">
          <table class="w-full min-w-[1080px] table-fixed text-left text-sm">
            <colgroup>
              <col class="w-[15%]" />
              <col class="w-[27%]" />
              <col class="w-[12%]" />
              <col class="w-[10%]" />
              <col class="w-[16%]" />
              <col class="w-[11%]" />
              <col class="w-[9%]" />
            </colgroup>
            <thead class="bg-[var(--dh-input)] text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
              <tr>
                <th class="px-4 py-3">Tarifa</th>
                <th class="px-4 py-3">Ruta</th>
                <th class="px-4 py-3">Cotizado por</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Actividad</th>
                <th class="px-4 py-3">Vigencia</th>
                <th class="px-4 py-3 text-right">Utilidad</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr
                v-for="rate in dashboard.recentRates"
                :key="rate.id"
                class="cursor-pointer transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                @click="openRate(rate.id)"
              >
                <td class="px-4 py-3 align-top">
                  <p class="break-all font-black text-[var(--dh-text)]">{{ rate.rateCode }}</p>
                  <p class="mt-1 truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.clientName || rate.carrierName || 'Sin cliente' }}</p>
                </td>
                <td class="px-4 py-3 align-top">
                  <p class="break-words font-semibold leading-5 text-[var(--dh-text)]">
                    {{ rate.polName }} → {{ rate.poeName }} → {{ rate.podName }}
                  </p>
                  <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ rate.containerTypeName }}</p>
                </td>
                <td class="px-4 py-3 align-top">
                  <p class="break-words font-black text-[var(--dh-text)]">{{ creatorDisplayName(rate) }}</p>
                  <p
                    v-if="creatorUserName(rate) && creatorUserName(rate).toLowerCase() !== creatorDisplayName(rate).toLowerCase()"
                    class="mt-1 truncate text-xs font-semibold text-[var(--dh-text-muted)]"
                  >
                    @{{ creatorUserName(rate) }}
                  </p>
                </td>
                <td class="px-4 py-3 align-top">
                  <DhBadge :label="statusLabel(rate.status)" :variant="statusTone(rate.status)" />
                </td>
                <td class="px-4 py-3 align-top text-[11px] font-semibold leading-4 text-[var(--dh-text-muted)]">
                  <p>Creada: {{ formatDateTime(rate.createdAtUtc) }}</p>
                  <p class="mt-1">Modificada: {{ formatDateTime(rate.updatedAtUtc) }}</p>
                </td>
                <td class="px-4 py-3 align-top text-[11px] font-semibold leading-4 text-[var(--dh-text-muted)]">
                  {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}
                </td>
                <td class="px-4 py-3 text-right align-top font-black text-green-600 dark:text-green-400">
                  <span class="whitespace-nowrap">{{ formatMoney(rate.totalUtilityAmount, currencyDisplayValue(rate.currencyCode)) }}</span>
                </td>
              </tr>
              <tr v-if="!dashboard.recentRates.length">
                <td colspan="7" class="px-5 py-10 text-center font-semibold text-[var(--dh-text-muted)]">
                  No hay tarifas para mostrar.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

