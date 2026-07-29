<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, Check, FileSearch, Ship, X } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { ImportRateDto } from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const props = withDefaults(
  defineProps<{
    importRate: ImportRateDto
    canApprove?: boolean
    canReject?: boolean
    canCreateRate?: boolean
    onApproved?: () => void | Promise<void>
    onReject?: (rate: ImportRateDto) => void | Promise<void>
    onCreateRate?: (rate: ImportRateDto) => void | Promise<void>
  }>(),
  {
    canApprove: false,
    canReject: false,
    canCreateRate: false,
  },
)

const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const current = ref<ImportRateDto>(props.importRate)
const loading = ref(false)
const approving = ref(false)

function displayName(
  items: typeof catalogs.carriers.value,
  id?: string | null,
  fallback = '—',
  ...values: Array<string | null | undefined>
) {
  return catalogs.findBestMatch(items, id, ...values)?.name || values.find(Boolean) || fallback
}

const carrier = computed(() =>
  displayName(
    catalogs.carriers.value,
    current.value.carrierId,
    '—',
    current.value.carrier,
    current.value.carrierCode,
    current.value.carrierSlug,
  ),
)
const agent = computed(() =>
  displayName(
    catalogs.agents.value,
    current.value.agentId,
    'Por asignar',
    current.value.agent,
    current.value.agentCode,
    current.value.agentSlug,
  ),
)
const pol = computed(() =>
  displayName(
    catalogs.polPorts.value,
    current.value.polId,
    '—',
    current.value.pol,
    current.value.polCode,
    current.value.polSlug,
  ),
)
const poe = computed(() =>
  displayName(
    catalogs.poePorts.value,
    current.value.poeId,
    '—',
    current.value.poe,
    current.value.poeCode,
    current.value.poeSlug,
  ),
)
const pod = computed(() =>
  displayName(
    catalogs.podPorts.value,
    current.value.podId,
    '—',
    current.value.pod,
    current.value.podCode,
    current.value.podSlug,
  ),
)
const container = computed(() =>
  displayName(
    catalogs.containerTypes.value,
    current.value.containerTypeId,
    '—',
    current.value.containerType,
    current.value.containerTypeCode,
    current.value.containerTypeSlug,
  ),
)
const currency = computed(() =>
  displayName(
    catalogs.currencies.value,
    current.value.currencyId,
    'USD',
    current.value.currency,
    current.value.currencyCode,
    current.value.currencySlug,
  ),
)
const profile = computed(() =>
  displayName(
    catalogs.importProfiles.value,
    current.value.importProfileId,
    '—',
    current.value.importProfileName,
    current.value.importProfileCode,
    current.value.importProfileSlug,
  ),
)
const route = computed(() =>
  [pol.value, poe.value, pod.value].filter((value) => value !== '—').join(' → '),
)
const oceanFreight = computed(() => current.value.oceanFreight ?? current.value.freight ?? 0)
const calculatedCost = computed(
  () =>
    current.value.totalCost ??
    oceanFreight.value +
      Number(current.value.originCharges ?? 0) +
      Number(current.value.destinationCharges ?? 0) +
      Number(current.value.surcharges ?? 0),
)
const calculatedProfit = computed(() => {
  if (current.value.profit != null) return current.value.profit
  if (current.value.totalSale == null) return null
  return current.value.totalSale - calculatedCost.value
})
const margin = computed(() => {
  const value = current.value.margin
  if (value == null) return null
  return Math.abs(value) <= 1 ? value * 100 : value
})
const canApproveCurrent = computed(
  () => props.canApprove && current.value.status === 'Pending' && !approving.value,
)
const canRejectCurrent = computed(() => props.canReject && current.value.status === 'Pending')
const canCreateCurrent = computed(() => props.canCreateRate && current.value.status === 'Approved')

const commercialRows = computed(() => [
  { label: 'Flete internacional', value: oceanFreight.value },
  { label: 'Cargos de origen', value: current.value.originCharges },
  { label: 'Cargos de destino', value: current.value.destinationCharges },
  { label: 'Recargos', value: current.value.surcharges },
])

function statusLabel(status: string) {
  return (
    (
      {
        Pending: 'Pendiente de revisión',
        Approved: 'Aprobada',
        Rejected: 'Rechazada',
        Created: 'Convertida en tarifa',
      } as Record<string, string>
    )[status] ?? status
  )
}

function sourceLabel(source: string) {
  return (
    (
      {
        Email: 'Correo',
        Pdf: 'PDF',
        Excel: 'Excel',
        Csv: 'CSV',
        Image: 'Imagen',
      } as Record<string, string>
    )[source] ?? source
  )
}

async function load() {
  try {
    loading.value = true
    const [, detail] = await Promise.all([
      catalogs.loadAll(),
      PricingService.getImportRate(props.importRate.id),
    ])
    current.value = detail
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el detalle de la tarifa importada.')
  } finally {
    loading.value = false
  }
}

async function approve() {
  if (!canApproveCurrent.value) return

  try {
    approving.value = true
    await PricingService.approveImportRate(current.value.id)
    current.value = { ...current.value, status: 'Approved' }
    toastStore.success(
      'Importación aprobada',
      'Los datos fueron revisados y la tarifa ya puede convertirse en una tarifa oficial.',
    )
    await props.onApproved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar la importación.')
  } finally {
    approving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <section
      class="dh-liquid rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
    >
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex min-w-0 gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]"
          >
            <FileSearch class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge :label="statusLabel(current.status)" :variant="statusTone(current.status)" />
              <DhBadge :label="sourceLabel(current.sourceType)" variant="neutral" />
              <DhBadge :label="profile" variant="neutral" />
            </div>
            <h2 class="mt-3 text-xl font-black text-[var(--dh-text)]">
              {{ carrier }} · {{ container }}
            </h2>
            <p class="mt-1 font-semibold text-[var(--dh-text-muted)]">{{ route }}</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <DhButton
            v-if="canRejectCurrent"
            label="Rechazar"
            :icon="X"
            variant="danger"
            size="sm"
            @click="props.onReject?.(current)"
          />
          <DhButton
            v-if="canApproveCurrent"
            label="Aprobar tarifa"
            :icon="Check"
            size="sm"
            :loading="approving"
            @click="approve"
          />
          <DhButton
            v-if="canCreateCurrent"
            label="Crear tarifa oficial"
            :icon="Ship"
            size="sm"
            @click="props.onCreateRate?.(current)"
          />
        </div>
      </div>
    </section>

    <div
      v-if="loading"
      class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]"
    >
      Cargando todos los datos de la tarifa...
    </div>

    <template v-else>
      <section>
        <h3 class="mb-3 font-black text-[var(--dh-text)]">Ruta y responsables</h3>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="item in [
              { label: 'Naviera', value: carrier },
              { label: 'Agente', value: agent },
              { label: 'POL · Origen', value: pol },
              { label: 'POE · Puerto de entrada', value: poe },
              { label: 'POD · Destino final', value: pod },
              { label: 'Contenedor', value: container },
            ]"
            :key="item.label"
            class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
          >
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              {{ item.label }}
            </p>
            <p class="mt-2 font-black text-[var(--dh-text)]">{{ item.value }}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-3 font-black text-[var(--dh-text)]">Valores importados</h3>
        <div
          class="overflow-hidden rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)]"
        >
          <div
            v-for="item in commercialRows"
            :key="item.label"
            class="flex items-center justify-between gap-4 border-b border-[var(--dh-border)] px-5 py-4 last:border-b-0"
          >
            <span class="font-semibold text-[var(--dh-text-soft)]">{{ item.label }}</span>
            <span class="font-black text-[var(--dh-text)]">
              {{ item.value == null ? 'No informado' : formatMoney(item.value, currency) }}
            </span>
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Costo total
            </p>
            <p class="mt-2 text-lg font-black text-[var(--dh-text)]">
              {{ formatMoney(calculatedCost, currency) }}
            </p>
          </div>
          <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Venta importada
            </p>
            <p class="mt-2 text-lg font-black text-[var(--dh-text)]">
              {{
                current.totalSale == null
                  ? 'No informada'
                  : formatMoney(current.totalSale, currency)
              }}
            </p>
          </div>
          <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Utilidad
            </p>
            <p class="mt-2 text-lg font-black text-[var(--dh-text)]">
              {{
                calculatedProfit == null ? 'No informada' : formatMoney(calculatedProfit, currency)
              }}
            </p>
          </div>
          <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Margen
            </p>
            <p class="mt-2 text-lg font-black text-[var(--dh-text)]">
              {{ margin == null ? 'No informado' : `${margin.toFixed(2)}%` }}
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in [
            { label: 'Moneda', value: currency },
            { label: 'Días libres', value: String(current.freeDays) },
            {
              label: 'Días de tránsito',
              value: current.transitDays == null ? 'No informados' : String(current.transitDays),
            },
            { label: 'Mercancía', value: current.commodity || 'No informada' },
            { label: 'Válida desde', value: formatDate(current.validFrom) },
            { label: 'Válida hasta', value: formatDate(current.validTo) },
            { label: 'Usos como tarifa', value: String(current.usedAsRateCount) },
            { label: 'Perfil de importación', value: profile },
          ]"
          :key="item.label"
          class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
        >
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ item.label }}
          </p>
          <p class="mt-2 font-black text-[var(--dh-text)]">{{ item.value }}</p>
        </div>
      </section>

      <section
        v-if="current.status === 'Pending'"
        class="flex gap-3 rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5"
      >
        <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Revise antes de aprobar</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">
            Confirme naviera, agente, ruta, contenedor, moneda, montos y vigencia. La aprobación
            solo se ejecuta desde esta vista previa.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
