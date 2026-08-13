<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  CalendarDays,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Route,
  Sparkles,
} from 'lucide-vue-next'
import {
  DhBadge,
  DhButton,
  DhEmptyState,
  DhInput,
  DhSelect,
  DhSpinner,
} from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type {
  ImportRateDto,
  ImportStatus,
  PricingDecisionDashboardDto,
  PricingDecisionLaneDto,
  PricingDecisionRateDto,
} from '@/core/interfaces/pricing'
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue'
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue'
import PricingWorkflowGuide from '@/modules/pricing/components/PricingWorkflowGuide.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const loading = ref(false)
const selectingImportId = ref('')
const creatingFinalRate = ref(false)
const approvingImportId = ref('')
const dashboard = ref<PricingDecisionDashboardDto | null>(null)
const selectedRate = ref<PricingDecisionRateDto | null>(null)
const selectedImport = ref<ImportRateDto | null>(null)
const filters = reactive({ dateFrom: '', dateTo: '', containerTypeId: '' })
const importCache = new Map<string, ImportRateDto>()

const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create))
const canApproveImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve))
const canCreateFinalRate = computed(
  () =>
    authStore.hasScope(PRICING_SCOPES.rates.create) &&
    authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)
const dateRangeInvalid = computed(() =>
  Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo),
)
const containerFilterOptions = computed(() => [
  { label: 'Todos los contenedores', value: '' },
  ...catalogs.containerOptions.value,
])

function matchesContainer(rate: PricingDecisionRateDto) {
  if (!filters.containerTypeId) return true

  return (
    catalogs.findBestMatch(catalogs.containerTypes.value, null, rate.containerType)?.id ===
    filters.containerTypeId
  )
}

const lanes = computed<PricingDecisionLaneDto[]>(() => {
  const source = dashboard.value?.lanes ?? []
  const order = ['limon-moin', 'puerto-caldera', 'multimodal']
  return [...source]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((lane) => {
      const rates = lane.rates.filter(matchesContainer)
      return { ...lane, rates, totalOptions: rates.length }
    })
})

const visibleTotalOptions = computed(() =>
  lanes.value.reduce((total, lane) => total + lane.totalOptions, 0),
)

const decisionRows = computed(() =>
  lanes.value
    .flatMap((lane) => lane.rates.map((rate) => ({ lane, rate })))
    .sort(
      (a, b) =>
        b.rate.priorityScore - a.rate.priorityScore ||
        comparableAmount(a.rate) - comparableAmount(b.rate),
    ),
)

const selectedLane = computed(
  () =>
    decisionRows.value.find((row) => row.rate.importRateId === selectedRate.value?.importRateId)
      ?.lane ?? null,
)

const selectedStatus = computed(() => selectedImport.value?.status ?? null)
const selectedNeedsApproval = computed(() => selectedStatus.value === 'Pending')
const selectedCanContinue = computed(() => {
  if (!selectedImport.value || !canCreateFinalRate.value) return false
  return ['Approved', 'Created'].includes(selectedImport.value.status)
})

function normalizeCurrency(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isUsd(rate: PricingDecisionRateDto) {
  const currency = normalizeCurrency(rate.currency)
  return currency.includes('usd') || currency.includes('dolar') || currency.includes('dollar')
}

function comparableAmount(rate: PricingDecisionRateDto) {
  return (rate.totalSale ?? rate.internationalOceanFreight) + (rate.internationalLandFreight ?? 0)
}

function totalFreightLabel(rate: PricingDecisionRateDto) {
  if (rate.internationalLandFreight == null) {
    return formatMoney(rate.internationalOceanFreight, rate.currency)
  }

  if (isUsd(rate)) {
    return formatMoney(comparableAmount(rate), 'USD')
  }

  return `${formatMoney(rate.internationalOceanFreight, rate.currency)} + ${formatMoney(
    rate.internationalLandFreight,
    'USD',
  )}`
}

function statusLabel(status: ImportStatus | null) {
  if (!status) return 'Cargando información'
  return (
    {
      Pending: 'Pendiente de aprobación',
      Approved: 'Lista para crear',
      Rejected: 'Rechazada',
      Created: 'Utilizada anteriormente',
      Expired: 'Vencida',
    } as Record<ImportStatus, string>
  )[status]
}

function statusVariant(
  status: ImportStatus | null,
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Approved' || status === 'Created') return 'success'
  if (status === 'Pending') return 'warning'
  if (status === 'Rejected' || status === 'Expired') return 'danger'
  return 'neutral'
}

function clearSelection() {
  selectedRate.value = null
  selectedImport.value = null
  selectingImportId.value = ''
}

async function load() {
  if (dateRangeInvalid.value) {
    toastStore.warning('La fecha desde no puede ser mayor que la fecha hasta.')
    return
  }

  try {
    loading.value = true
    dashboard.value = await PricingService.getDecisionDashboard({
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
    })

    clearSelection()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el dashboard para toma de decisiones.')
  } finally {
    loading.value = false
  }
}

async function clearFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.containerTypeId = ''
  await load()
}

function openUpload() {
  drawerStore.open({
    title: 'Importar tarifario',
    component: PricingUploadDrawer,
    size: 'lg',
    props: { onSaved: load },
  })
}

async function selectRate(rate: PricingDecisionRateDto) {
  selectedRate.value = rate
  selectedImport.value = null
  selectingImportId.value = rate.importRateId

  try {
    const cached = importCache.get(rate.importRateId)
    const source = cached ?? (await PricingService.getImportRate(rate.importRateId))
    importCache.set(rate.importRateId, source)

    if (selectedRate.value?.importRateId === rate.importRateId) {
      selectedImport.value = source
    }
  } catch (error) {
    clearSelection()
    toastStore.backendError(error, 'No se pudo cargar la tarifa importada seleccionada.')
  } finally {
    if (selectingImportId.value === rate.importRateId) selectingImportId.value = ''
  }
}

async function openCreatedRate(rateId: string) {
  try {
    const createdRate = await PricingService.getRate(rateId)
    drawerStore.open({
      title: 'Tarifa final creada',
      component: PricingRateDetailDrawer,
      size: 'xl',
      props: { rate: createdRate, onSaved: load },
    })
  } catch (error) {
    toastStore.backendError(
      error,
      'La tarifa fue creada, pero no se pudo abrir automáticamente su detalle.',
    )
  }
}

async function approveDecisionRate(rate: PricingDecisionRateDto) {
  if (!canApproveImport.value || rate.status !== 'Pending' || approvingImportId.value) return

  try {
    approvingImportId.value = rate.importRateId
    await PricingService.approveImportRate(rate.importRateId)
    importCache.delete(rate.importRateId)
    rate.status = 'Approved'

    if (selectedRate.value?.importRateId === rate.importRateId) {
      const refreshed = await PricingService.getImportRate(rate.importRateId)
      selectedImport.value = refreshed
      importCache.set(rate.importRateId, refreshed)
    }

    toastStore.success(
      'Tarifa importada aprobada',
      'La tarifa ya está disponible para crear una tarifa final.',
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar la tarifa importada.')
  } finally {
    approvingImportId.value = ''
  }
}

async function approveSelectedImport() {
  if (!selectedRate.value) return
  await approveDecisionRate(selectedRate.value)
}

async function createFinalRate() {
  if (!selectedRate.value || !selectedImport.value || !selectedCanContinue.value) return

  try {
    creatingFinalRate.value = true
    const source = selectedImport.value

    drawerStore.open({
      title: `Crear tarifa final · ${source.carrier}`,
      component: PricingRateFormDrawer,
      size: 'full',
      props: {
        sourceImport: source,
        decisionInternationalLandFreight: selectedRate.value?.internationalLandFreight ?? null,
        onSaved: async (rateId?: string) => {
          await load()
          if (rateId) await openCreatedRate(rateId)
        },
      },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo preparar la creación de la tarifa final.')
  } finally {
    creatingFinalRate.value = false
  }
}

watch(
  () => filters.containerTypeId,
  () => clearSelection(),
)

onMounted(() => {
  void catalogs.loadAll()
  void load()
})
</script>

<template>
  <section class="space-y-5 pb-28">
    <DhPageHeader
      title="Selección de tarifas FCL"
      subtitle="Compare todas las alternativas disponibles en una sola tabla y cree la tarifa final desde la opción seleccionada."
      :icon="Route"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton
            v-if="canUpload"
            label="Importar tarifario"
            :icon="FileSpreadsheet"
            variant="secondary"
            @click="openUpload"
          />
          <DhButton
            label="Actualizar"
            :icon="RefreshCw"
            variant="secondary"
            :loading="loading"
            @click="load"
          />
        </div>
      </template>
    </DhPageHeader>

    <PricingWorkflowGuide current="decision" compact />

    <section
      class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]"
    >
      <div
        class="flex flex-col gap-4 border-b border-[var(--dh-border)] p-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">
            Comparador operativo
          </p>
          <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 class="text-xl font-black text-[var(--dh-text)]">Tarifas disponibles</h2>
            <span class="text-sm font-bold text-[var(--dh-text-muted)]">
              {{ visibleTotalOptions }} alternativa{{ visibleTotalOptions === 1 ? '' : 's' }}
            </span>
          </div>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Ordenadas por prioridad: 50% comentarios de espacios · 30% precio · 20% margen.
          </p>
        </div>

        <div class="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[650px]">
          <DhInput
            v-model="filters.dateFrom"
            type="date"
            label="Fecha desde"
            :error="dateRangeInvalid ? 'Rango inválido' : undefined"
          />
          <DhInput
            v-model="filters.dateTo"
            type="date"
            label="Fecha hasta"
            :error="dateRangeInvalid ? 'Rango inválido' : undefined"
          />
          <DhSelect
            v-model="filters.containerTypeId"
            label="Contenedor"
            :options="containerFilterOptions"
            placeholder=""
            :disabled="catalogs.loading.value"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3">
        <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]">
          <span>Se muestran todas las vías de salida en la misma tabla.</span>
          <DhBadge
            v-for="lane in lanes"
            :key="lane.key"
            :label="`${lane.name}: ${lane.totalOptions}`"
            variant="neutral"
          />
        </div>
        <div class="flex gap-2">
          <DhButton
            label="Aplicar filtros"
            :icon="CalendarDays"
            size="sm"
            :disabled="dateRangeInvalid"
            :loading="loading"
            @click="load"
          />
          <DhButton
            label="Limpiar"
            size="sm"
            variant="ghost"
            :disabled="loading || (!filters.dateFrom && !filters.dateTo && !filters.containerTypeId)"
            @click="clearFilters"
          />
        </div>
      </div>

      <div v-if="loading && !dashboard" class="flex min-h-[360px] items-center justify-center">
        <DhSpinner size="lg" />
      </div>

      <div
        v-else-if="decisionRows.length"
        class="dh-scrollbar m-4 overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl"
      >
        <table class="w-full min-w-[1720px] border-collapse text-left text-xs sm:text-sm">
          <thead class="bg-black/[0.035] text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
            <tr class="font-black uppercase tracking-[0.1em] sm:tracking-[0.12em]">
              <th class="w-12 px-3 py-3 text-center">Sel.</th>
              <th class="w-12 px-3 py-3">#</th>
              <th class="px-3 py-3">Prioridad</th>
              <th class="px-3 py-3">Vía / POE</th>
              <th class="px-3 py-3">Naviera</th>
              <th class="px-3 py-3">POL</th>
              <th class="px-3 py-3">POD</th>
              <th class="px-3 py-3">Contenedor</th>
              <th class="px-3 py-3 text-right">Flete marítimo</th>
              <th class="px-3 py-3 text-right">Flete terrestre</th>
              <th class="px-3 py-3 text-right">Total comparado</th>
              <th class="px-3 py-3 text-right">Margen</th>
              <th class="px-3 py-3">Espacio</th>
              <th class="px-3 py-3">Comentario / criterio</th>
              <th class="px-3 py-3 text-center">Estado</th>
              <th class="px-3 py-3">Vigencia</th>
              <th class="sticky right-0 z-20 bg-[var(--dh-card)] px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="({ lane, rate }, index) in decisionRows"
              :key="rate.importRateId"
              class="group cursor-pointer border-t border-[var(--dh-border)] transition-colors"
              :class="
                selectedRate?.importRateId === rate.importRateId
                  ? 'bg-[var(--dh-primary)]/[0.075]'
                  : index === 0
                    ? 'bg-emerald-500/[0.035] hover:bg-emerald-500/[0.07]'
                    : 'bg-[var(--dh-card)] hover:bg-[var(--dh-card-hover)]'
              "
              @click="selectRate(rate)"
            >
              <td class="px-3 py-3 text-center">
                <span
                  class="mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 transition"
                  :class="
                    selectedRate?.importRateId === rate.importRateId
                      ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border-strong)] bg-[var(--dh-card)] text-transparent group-hover:border-[var(--dh-primary)]/60'
                  "
                >
                  <Check class="h-3 w-3" />
                </span>
              </td>
              <td class="px-3 py-3 text-sm font-black text-[var(--dh-primary)]">{{ index + 1 }}</td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <DhBadge v-if="index === 0" label="Recomendada" variant="success" />
                  <strong class="text-sm text-[var(--dh-text)]">{{ rate.priorityScore.toFixed(1) }}</strong>
                </div>
                <div class="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <span
                    class="block h-full rounded-full bg-[var(--dh-primary)]"
                    :style="{ width: `${Math.min(100, Math.max(0, rate.priorityScore))}%` }"
                  />
                </div>
              </td>
              <td class="px-3 py-3">
                <strong class="block whitespace-nowrap text-sm text-[var(--dh-text)]">{{ lane.name }}</strong>
                <span class="mt-0.5 block whitespace-nowrap text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  POE: {{ rate.poe }}
                </span>
              </td>
              <td class="px-3 py-3">
                <strong class="whitespace-nowrap text-sm text-[var(--dh-text)]">{{ rate.carrier }}</strong>
              </td>
              <td class="px-3 py-3 text-xs font-bold text-[var(--dh-text-soft)]">
                <span class="whitespace-nowrap">{{ rate.pol }}</span>
              </td>
              <td class="px-3 py-3 text-xs font-bold text-[var(--dh-text-soft)]">
                <span class="whitespace-nowrap">{{ rate.pod || '—' }}</span>
              </td>
              <td class="px-3 py-3">
                <DhBadge :label="rate.containerType" variant="primary" />
              </td>
              <td class="px-3 py-3 text-right text-sm font-bold text-[var(--dh-text)]">
                {{ formatMoney(rate.internationalOceanFreight, rate.currency) }}
              </td>
              <td class="px-3 py-3 text-right text-sm font-bold text-[var(--dh-text)]">
                {{
                  rate.internationalLandFreight != null
                    ? formatMoney(rate.internationalLandFreight, 'USD')
                    : '—'
                }}
              </td>
              <td class="px-3 py-3 text-right text-sm font-black text-[var(--dh-primary)]">
                <span class="whitespace-nowrap">{{ totalFreightLabel(rate) }}</span>
              </td>
              <td class="px-3 py-3 text-right">
                <span
                  class="whitespace-nowrap text-sm font-black"
                  :class="
                    rate.margin == null
                      ? 'text-[var(--dh-text-muted)]'
                      : rate.margin >= 12
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                  "
                >
                  {{ rate.margin != null ? `${rate.margin.toFixed(1)}%` : '—' }}
                </span>
              </td>
              <td class="px-3 py-3">
                <DhBadge
                  :label="`${rate.spaceScore.toFixed(0)}/100 · ${rate.spaceRisk}`"
                  :variant="
                    rate.spaceRisk === 'Bajo'
                      ? 'success'
                      : rate.spaceRisk === 'Alto'
                        ? 'danger'
                        : 'warning'
                  "
                />
              </td>
              <td class="max-w-[360px] px-3 py-3">
                <p
                  class="line-clamp-2 text-xs font-semibold leading-5 text-[var(--dh-text-soft)]"
                  :title="`${rate.spaceComment || 'Sin comentario operativo'}\n\n${rate.priorityReason}`"
                >
                  {{ rate.spaceComment || 'Sin comentario operativo' }}
                </p>
                <p class="mt-0.5 line-clamp-1 text-[10px] font-bold text-[var(--dh-text-muted)]">
                  {{ rate.priorityReason }}
                </p>
              </td>
              <td class="px-3 py-3 text-center">
                <DhBadge :label="statusLabel(rate.status)" :variant="statusVariant(rate.status)" />
              </td>
              <td class="px-3 py-3 text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]">
                <span class="whitespace-nowrap">{{ formatDate(rate.validFrom) }}</span>
                <span class="mx-1">→</span>
                <span class="whitespace-nowrap">{{ formatDate(rate.validTo) }}</span>
              </td>
              <td
                class="sticky right-0 z-[5] border-l border-[var(--dh-border)] px-3 py-3 text-right"
                :class="
                  selectedRate?.importRateId === rate.importRateId
                    ? 'bg-[color-mix(in_srgb,var(--dh-primary)_7%,var(--dh-card))]'
                    : 'bg-[var(--dh-card)] group-hover:bg-[var(--dh-card-hover)]'
                "
              >
                <div class="flex justify-end gap-1.5">
                  <DhButton
                    v-if="rate.status === 'Pending' && canApproveImport"
                    label="Aprobar"
                    variant="primary"
                    size="sm"
                    :loading="approvingImportId === rate.importRateId"
                    :disabled="Boolean(approvingImportId)"
                    @click.stop="approveDecisionRate(rate)"
                  />
                  <DhButton
                    :label="selectedRate?.importRateId === rate.importRateId ? 'Seleccionada' : 'Seleccionar'"
                    :variant="selectedRate?.importRateId === rate.importRateId ? 'primary' : 'secondary'"
                    size="sm"
                    :loading="selectingImportId === rate.importRateId"
                    @click.stop="selectRate(rate)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <DhEmptyState
        v-else
        class="m-5"
        title="Sin tarifas para comparar"
        description="Cambie el contenedor o el rango de fechas para encontrar tarifas importadas vigentes."
        :icon="Route"
      />
    </section>

    <section
      v-if="selectedRate"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--dh-border-strong)] bg-[var(--dh-shell-strong)]/95 shadow-[0_-12px_35px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
    >
      <div class="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between lg:px-6">
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-primary)]">Tarifa seleccionada</p>
            <p class="truncate text-sm font-black text-[var(--dh-text)]">
              {{ selectedRate.carrier }} · {{ selectedRate.pol }} → {{ selectedRate.poe }} · {{ selectedRate.containerType }}
            </p>
          </div>
          <div class="hidden h-8 w-px bg-[var(--dh-border)] md:block" />
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Vía</p>
            <p class="text-sm font-bold text-[var(--dh-text)]">{{ selectedLane?.name || selectedRate.poe }}</p>
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo comparado</p>
            <p class="text-sm font-black text-[var(--dh-primary)]">{{ totalFreightLabel(selectedRate) }}</p>
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Prioridad</p>
            <p class="text-sm font-black text-[var(--dh-text)]">{{ selectedRate.priorityScore.toFixed(1) }}/100</p>
          </div>
          <DhBadge
            v-if="selectedImport"
            :label="statusLabel(selectedStatus)"
            :variant="statusVariant(selectedStatus)"
          />
          <DhSpinner v-else-if="selectingImportId" size="sm" />
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <DhButton label="Cancelar selección" variant="ghost" size="sm" @click="clearSelection" />
          <DhButton
            v-if="selectedNeedsApproval && canApproveImport"
            label="Aprobar tarifa importada"
            :icon="Check"
            size="sm"
            :loading="approvingImportId === selectedRate.importRateId"
            :disabled="Boolean(approvingImportId)"
            @click="approveSelectedImport"
          />
          <DhButton
            v-else
            label="Crear tarifa final"
            :icon="Sparkles"
            size="sm"
            :loading="creatingFinalRate || Boolean(selectingImportId)"
            :disabled="!selectedCanContinue"
            @click="createFinalRate"
          />
        </div>
      </div>

      <div
        v-if="selectedNeedsApproval && !canApproveImport"
        class="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-semibold text-amber-800 dark:text-amber-300"
      >
        Esta importación requiere aprobación antes de poder crear la tarifa final.
      </div>
      <div
        v-else-if="selectedStatus === 'Rejected'"
        class="border-t border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs font-semibold text-red-700 dark:text-red-300"
      >
        Esta alternativa fue rechazada y no puede utilizarse para crear una tarifa final.
      </div>
    </section>
  </section>
</template>
