<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Anchor,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileSpreadsheet,
  MapPin,
  Package,
  RefreshCw,
  Route,
  Ship,
  Sparkles,
  Truck,
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
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const loading = ref(false)
const selectingImportId = ref('')
const creatingFinalRate = ref(false)
const dashboard = ref<PricingDecisionDashboardDto | null>(null)
const selectedRate = ref<PricingDecisionRateDto | null>(null)
const selectedImport = ref<ImportRateDto | null>(null)
const activeLaneKey = ref<PricingDecisionLaneDto['key']>('limon-moin')
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

const activeLane = computed(
  () => lanes.value.find((lane) => lane.key === activeLaneKey.value) ?? lanes.value[0] ?? null,
)

const activeRates = computed(() =>
  [...(activeLane.value?.rates ?? [])].sort((a, b) => comparableAmount(a) - comparableAmount(b)),
)

const selectedStatus = computed(() => selectedImport.value?.status ?? null)
const selectedNeedsApproval = computed(() => selectedStatus.value === 'Pending')
const selectedCanContinue = computed(() => {
  if (!selectedImport.value || !canCreateFinalRate.value) return false
  if (selectedImport.value.status === 'Rejected') return false
  if (selectedImport.value.status === 'Pending') return canApproveImport.value
  return ['Approved', 'Created'].includes(selectedImport.value.status)
})

const finalActionLabel = computed(() => {
  if (selectedNeedsApproval.value && canApproveImport.value) return 'Aprobar y crear tarifa final'
  return 'Crear tarifa final'
})

function laneIcon(lane: PricingDecisionLaneDto) {
  if (lane.key === 'multimodal') return Truck
  if (lane.key === 'puerto-caldera') return Anchor
  return Ship
}

function laneAccent(lane: PricingDecisionLaneDto, active = false) {
  if (active)
    return 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]'
  if (lane.key === 'multimodal')
    return 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
  if (lane.key === 'puerto-caldera')
    return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
}

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
  return rate.internationalOceanFreight + (rate.internationalLandFreight ?? 0)
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

function lowestLaneLabel(lane: PricingDecisionLaneDto) {
  if (!lane.rates.length) return 'Sin opciones'
  const best = [...lane.rates].sort((a, b) => comparableAmount(a) - comparableAmount(b))[0]
  return `Desde ${totalFreightLabel(best!)}`
}

function statusLabel(status: ImportStatus | null) {
  if (!status) return 'Cargando información'
  return (
    {
      Pending: 'Pendiente de aprobación',
      Approved: 'Lista para crear',
      Rejected: 'Rechazada',
      Created: 'Utilizada anteriormente',
    } as Record<ImportStatus, string>
  )[status]
}

function statusVariant(
  status: ImportStatus | null,
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Approved' || status === 'Created') return 'success'
  if (status === 'Pending') return 'warning'
  if (status === 'Rejected') return 'danger'
  return 'neutral'
}

function clearSelection() {
  selectedRate.value = null
  selectedImport.value = null
  selectingImportId.value = ''
}

function changeLane(key: PricingDecisionLaneDto['key']) {
  if (activeLaneKey.value === key) return
  activeLaneKey.value = key
  clearSelection()
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

    if (!dashboard.value.lanes.some((lane) => lane.key === activeLaneKey.value)) {
      activeLaneKey.value = dashboard.value.lanes[0]?.key ?? 'limon-moin'
    }
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

async function createFinalRate() {
  if (!selectedRate.value || !selectedImport.value || !selectedCanContinue.value) return

  try {
    creatingFinalRate.value = true
    let source = selectedImport.value

    if (source.status === 'Pending') {
      await PricingService.approveImportRate(source.id)
      source = await PricingService.getImportRate(source.id)
      selectedImport.value = source
      importCache.set(source.id, source)
      toastStore.success(
        'Importación aprobada',
        'La alternativa seleccionada ya puede convertirse en tarifa final.',
      )
    }

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
  <section class="space-y-6 pb-6">
    <DhPageHeader
      title="Mesa de decisión FCL"
      subtitle="Seleccione una alternativa importada y conviértala directamente en la tarifa final para el cliente."
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

    <section
      class="dh-liquid overflow-hidden rounded-[32px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]"
    >
      <div class="grid lg:grid-cols-[1.25fr_0.75fr]">
        <div class="relative overflow-hidden p-6 md:p-8">
          <div
            class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--dh-primary)] opacity-[0.08] blur-3xl"
          />
          <DhBadge label="Decisión → cotización final" variant="primary" />
          <h2
            class="relative mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-[var(--dh-text)] md:text-4xl"
          >
            Compare el costo de salida y cree la opción elegida sin perder el contexto.
          </h2>

          <div class="relative mt-6 flex flex-wrap gap-3">
            <div
              class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3"
            >
              <p
                class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
              >
                Alternativas disponibles
              </p>
              <p class="mt-1 text-2xl font-black text-[var(--dh-text)]">
                {{ visibleTotalOptions }}
              </p>
            </div>
          </div>
        </div>

        <div
          class="border-t border-[var(--dh-border)] bg-black/[0.025] p-6 dark:bg-white/[0.025] lg:border-l lg:border-t-0 md:p-8"
        >
          <div class="flex items-center gap-2">
            <CalendarDays class="h-4 w-4 text-[var(--dh-primary)]" />
            <h3 class="text-sm font-black text-[var(--dh-text)]">Filtros de decisión</h3>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
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
              class="sm:col-span-2"
              label="Contenedor"
              :options="containerFilterOptions"
              placeholder=""
              :disabled="catalogs.loading.value"
            />
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <DhButton
              label="Aplicar filtros"
              :icon="CalendarDays"
              :disabled="dateRangeInvalid"
              :loading="loading"
              @click="load"
            />
            <DhButton
              label="Limpiar"
              variant="ghost"
              :disabled="
                loading || (!filters.dateFrom && !filters.dateTo && !filters.containerTypeId)
              "
              @click="clearFilters"
            />
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center gap-3">
        <span
          class="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white"
          >1</span
        >
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Seleccione la vía de salida</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Las opciones se agrupan automáticamente por POE.
          </p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <button
          v-for="lane in lanes"
          :key="lane.key"
          type="button"
          class="group rounded-[26px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]"
          :class="
            activeLaneKey === lane.key
              ? 'border-[var(--dh-primary)] bg-[var(--dh-card)] ring-2 ring-[var(--dh-primary)]/15'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/35'
          "
          @click="changeLane(lane.key)"
        >
          <div class="flex items-start justify-between gap-3">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border transition"
              :class="laneAccent(lane, activeLaneKey === lane.key)"
            >
              <component :is="laneIcon(lane)" class="h-5 w-5" />
            </span>
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full border transition"
              :class="
                activeLaneKey === lane.key
                  ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                  : 'border-[var(--dh-border)] text-transparent'
              "
            >
              <Check class="h-4 w-4" />
            </span>
          </div>
          <h3 class="mt-4 text-base font-black text-[var(--dh-text)]">{{ lane.name }}</h3>
          <p class="mt-1 min-h-10 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            {{ lane.description }}
          </p>
          <div
            class="mt-4 flex items-end justify-between gap-3 border-t border-[var(--dh-border)] pt-3"
          >
            <div>
              <p class="text-xl font-black text-[var(--dh-text)]">{{ lane.totalOptions }}</p>
              <p
                class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
              >
                Opciones
              </p>
            </div>
            <p class="text-right text-xs font-black text-[var(--dh-primary)]">
              {{ lowestLaneLabel(lane) }}
            </p>
          </div>
        </button>
      </div>
    </section>

    <div v-if="loading && !dashboard" class="flex min-h-[360px] items-center justify-center">
      <DhSpinner size="lg" />
    </div>

    <section v-else class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start">
      <article
        class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)] md:p-6"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white"
              >2</span
            >
            <div>
              <h2 class="text-lg font-black text-[var(--dh-text)]">
                Compare y marque una alternativa
              </h2>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ activeLane?.name }} · ordenadas de menor a mayor costo de transporte
              </p>
            </div>
          </div>
          <DhBadge :label="`${activeRates.length} disponibles`" variant="neutral" />
        </div>

        <div v-if="activeRates.length" class="mt-5 grid gap-4 lg:grid-cols-2">
          <button
            v-for="(rate, index) in activeRates"
            :key="rate.importRateId"
            type="button"
            class="relative overflow-hidden rounded-[26px] border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]"
            :class="
              selectedRate?.importRateId === rate.importRateId
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/[0.035] ring-2 ring-[var(--dh-primary)]/15'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)] hover:border-[var(--dh-primary)]/35'
            "
            @click="selectRate(rate)"
          >
            <div
              v-if="selectedRate?.importRateId === rate.importRateId"
              class="absolute right-0 top-0 h-20 w-20 rounded-bl-[70px] bg-[var(--dh-primary)]/10"
            />

            <div class="relative flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <DhBadge v-if="index === 0" label="Menor costo" variant="success" />
                  <DhBadge :label="rate.containerType" variant="primary" />
                </div>
                <h3 class="mt-3 truncate text-xl font-black tracking-tight text-[var(--dh-text)]">
                  {{ rate.carrier }}
                </h3>
                <p
                  class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--dh-text-muted)]"
                >
                  <MapPin class="h-3.5 w-3.5" />
                  {{ rate.pol }} → {{ rate.poe }}
                </p>
              </div>
              <span
                class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition"
                :class="
                  selectedRate?.importRateId === rate.importRateId
                    ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-transparent'
                "
              >
                <Check class="h-4 w-4" />
              </span>
            </div>

            <div class="relative mt-5 grid gap-3 sm:grid-cols-2">
              <div
                class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3.5"
              >
                <p
                  class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
                >
                  Marítimo internacional
                </p>
                <p class="mt-1 text-lg font-black text-[var(--dh-text)]">
                  {{ formatMoney(rate.internationalOceanFreight, rate.currency) }}
                </p>
              </div>
              <div
                class="rounded-[18px] border p-3.5"
                :class="
                  rate.internationalLandFreight != null
                    ? 'border-violet-500/20 bg-violet-500/10'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)]'
                "
              >
                <p
                  class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
                >
                  {{
                    rate.internationalLandFreight != null
                      ? 'Terrestre internacional'
                      : 'Costo de la vía'
                  }}
                </p>
                <p class="mt-1 text-lg font-black text-[var(--dh-text)]">
                  {{
                    rate.internationalLandFreight != null
                      ? formatMoney(rate.internationalLandFreight, 'USD')
                      : formatMoney(rate.internationalOceanFreight, rate.currency)
                  }}
                </p>
              </div>
            </div>

            <div
              class="relative mt-4 flex items-end justify-between gap-4 border-t border-[var(--dh-border)] pt-4"
            >
              <div>
                <p
                  class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
                >
                  Costo transporte considerado
                </p>
                <p class="mt-1 text-xl font-black text-[var(--dh-primary)]">
                  {{ totalFreightLabel(rate) }}
                </p>
              </div>
              <p class="text-right text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]">
                {{ formatDate(rate.validFrom) }}<br />{{ formatDate(rate.validTo) }}
              </p>
            </div>

            <div
              v-if="selectingImportId === rate.importRateId"
              class="absolute inset-0 flex items-center justify-center bg-[var(--dh-card)]/80 backdrop-blur-sm"
            >
              <DhSpinner />
            </div>
          </button>
        </div>

        <DhEmptyState
          v-else
          class="mt-5"
          title="Sin alternativas para esta vía"
          description="Cambie la vía, el contenedor o el rango de fechas para encontrar tarifas importadas vigentes."
          :icon="activeLane ? laneIcon(activeLane) : Route"
        />
      </article>

      <aside class="xl:sticky xl:top-5">
        <section
          class="overflow-hidden rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]"
        >
          <header class="border-b border-[var(--dh-border)] p-5">
            <div class="flex items-center gap-3">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white"
                >3</span
              >
              <div>
                <h2 class="text-lg font-black text-[var(--dh-text)]">Crear tarifa final</h2>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  Confirmación de la opción elegida
                </p>
              </div>
            </div>
          </header>

          <div v-if="selectedRate" class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <DhBadge
                  :label="statusLabel(selectedStatus)"
                  :variant="statusVariant(selectedStatus)"
                />
                <h3 class="mt-3 truncate text-xl font-black text-[var(--dh-text)]">
                  {{ selectedRate.carrier }}
                </h3>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ activeLane?.name }}
                </p>
              </div>
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-green-500/10 text-green-600 dark:text-green-400"
              >
                <CheckCircle2 class="h-5 w-5" />
              </span>
            </div>

            <div class="mt-5 space-y-2.5">
              <div
                class="flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]"
              >
                <span class="flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
                  ><Ship class="h-4 w-4" /> Marítimo</span
                >
                <strong class="text-sm text-[var(--dh-text)]">{{
                  formatMoney(selectedRate.internationalOceanFreight, selectedRate.currency)
                }}</strong>
              </div>
              <div
                v-if="selectedRate.internationalLandFreight != null"
                class="flex items-center justify-between gap-3 rounded-[17px] bg-violet-500/10 px-3.5 py-3"
              >
                <span
                  class="flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300"
                  ><Truck class="h-4 w-4" /> Terrestre</span
                >
                <strong class="text-sm text-[var(--dh-text)]">{{
                  formatMoney(selectedRate.internationalLandFreight, 'USD')
                }}</strong>
              </div>
              <div
                class="flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]"
              >
                <span class="flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
                  ><Package class="h-4 w-4" /> Contenedor</span
                >
                <strong class="text-sm text-[var(--dh-text)]">{{
                  selectedRate.containerType
                }}</strong>
              </div>
              <div
                class="flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]"
              >
                <span class="flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"
                  ><MapPin class="h-4 w-4" /> Ruta</span
                >
                <strong class="max-w-[190px] truncate text-right text-sm text-[var(--dh-text)]"
                  >{{ selectedRate.pol }} → {{ selectedRate.poe }}</strong
                >
              </div>
            </div>

            <div
              class="mt-5 rounded-[22px] bg-[var(--dh-primary)] p-4 text-white shadow-[var(--dh-glow)]"
            >
              <p class="text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                Costo seleccionado
              </p>
              <p class="mt-1 text-2xl font-black">{{ totalFreightLabel(selectedRate) }}</p>
              <p class="mt-1 text-[11px] font-semibold text-white/75">
                Este será el origen de la tarifa oficial para el cliente.
              </p>
            </div>

            <div
              v-if="selectedNeedsApproval && !canApproveImport"
              class="mt-4 rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-300"
            >
              La importación está pendiente. Una persona con permiso de aprobación debe aprobarla
              antes de crear la tarifa final.
            </div>

            <div
              v-if="selectedStatus === 'Rejected'"
              class="mt-4 rounded-[18px] border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold leading-5 text-red-700 dark:text-red-300"
            >
              Esta alternativa fue rechazada y no puede utilizarse para generar una tarifa final.
            </div>

            <DhButton
              class="mt-5 w-full"
              :label="finalActionLabel"
              :icon="Sparkles"
              size="lg"
              :loading="creatingFinalRate || Boolean(selectingImportId)"
              :disabled="!selectedCanContinue"
              @click="createFinalRate"
            />
            <button
              type="button"
              class="mt-3 w-full text-center text-xs font-black text-[var(--dh-text-muted)] transition hover:text-[var(--dh-primary)]"
              @click="clearSelection"
            >
              Cambiar selección
            </button>
          </div>

          <div v-else class="p-5">
            <div
              class="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--dh-border)] bg-black/[0.02] p-6 text-center dark:bg-white/[0.02]"
            >
              <span
                class="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]"
              >
                <CircleDollarSign class="h-7 w-7" />
              </span>
              <h3 class="mt-5 text-lg font-black text-[var(--dh-text)]">
                Aún no ha elegido una tarifa
              </h3>
              <p class="mt-2 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
                Marque una tarjeta en el comparador. Aquí verá exactamente la importación que se
                convertirá en tarifa final.
              </p>
            </div>
          </div>
        </section>

        <div
          class="mt-3 flex items-start gap-3 rounded-[22px] border border-green-500/20 bg-green-500/10 p-4"
        >
          <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p class="text-xs font-semibold leading-5 text-green-800 dark:text-green-300">
            Al guardar, el dashboard abrirá automáticamente la tarifa oficial creada para revisar
            costos, venta, utilidad y margen.
          </p>
        </div>
      </aside>
    </section>
  </section>
</template>
