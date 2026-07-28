<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, Check, FileSearch, Save, Ship, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
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
    canEdit?: boolean
    onApproved?: () => void | Promise<void>
    onUpdated?: () => void | Promise<void>
    onReject?: (rate: ImportRateDto) => void | Promise<void>
    onCreateRate?: (rate: ImportRateDto) => void | Promise<void>
  }>(),
  {
    canApprove: false,
    canReject: false,
    canCreateRate: false,
    canEdit: false,
  },
)

const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const current = ref<ImportRateDto>(props.importRate)
const loading = ref(false)
const approving = ref(false)
const saving = ref(false)
const selected = ref({
  importProfileId: '',
  polId: '',
  poeId: '',
  podId: '',
  carrierId: '',
  agentId: '',
  containerTypeId: '',
  currencyId: '',
})

function displayName(
  items: typeof catalogs.carriers.value,
  id?: string | null,
  fallback = '—',
  ...values: Array<string | null | undefined>
) {
  return catalogs.findById(items, id)?.name || values.find(Boolean) || fallback
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
const agent = computed(
  () =>
    catalogs.findById(catalogs.agents.value, current.value.agentId)?.name ||
    current.value.agent ||
    'Por asignar',
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
    'Por asignar',
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
  () =>
    props.canApprove &&
    current.value.status === 'Pending' &&
    current.value.hasConfigConcordance &&
    !approving.value,
)
const canRejectCurrent = computed(() => props.canReject && current.value.status === 'Pending')
const canCreateCurrent = computed(() => props.canCreateRate && current.value.status === 'Approved')
const canEditCurrent = computed(
  () => props.canEdit && current.value.status === 'Pending' && !saving.value,
)
const canSaveCatalogs = computed(
  () => canEditCurrent.value && Object.values(selected.value).every((value) => Boolean(value)),
)

const unresolvedLabels = computed(() => {
  const labels: Record<string, string> = {
    'pricing-imports-profiles': 'Perfil de importación',
    pol: 'POL',
    poe: 'POE',
    pod: 'POD oficial',
    carriers: 'Naviera',
    agents: 'Agente',
    'container-types': 'Contenedor',
    currencies: 'Moneda',
  }
  return (current.value.unresolvedCatalogs ?? []).map((slug) => labels[slug] ?? slug)
})

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
    const resolvedSelection = {
      importProfileId:
        catalogs.findById(catalogs.importProfiles.value, detail.importProfileId)?.id ?? '',
      polId: catalogs.findById(catalogs.polPorts.value, detail.polId)?.id ?? '',
      poeId: catalogs.findById(catalogs.poePorts.value, detail.poeId)?.id ?? '',
      podId: catalogs.findById(catalogs.podPorts.value, detail.podId)?.id ?? '',
      carrierId: catalogs.findById(catalogs.carriers.value, detail.carrierId)?.id ?? '',
      agentId: catalogs.findById(catalogs.agents.value, detail.agentId)?.id ?? '',
      containerTypeId:
        catalogs.findById(catalogs.containerTypes.value, detail.containerTypeId)?.id ?? '',
      currencyId: catalogs.findById(catalogs.currencies.value, detail.currencyId)?.id ?? '',
    }
    selected.value = resolvedSelection
    current.value = {
      ...detail,
      hasConfigConcordance: Object.values(resolvedSelection).every(Boolean),
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el detalle de la tarifa importada.')
  } finally {
    loading.value = false
  }
}

async function saveCatalogs() {
  if (!canSaveCatalogs.value) {
    toastStore.warning(
      'Catálogos incompletos',
      'Seleccione perfil, POL, POE, POD, naviera, agente, contenedor y moneda.',
    )
    return
  }

  try {
    saving.value = true
    await PricingService.updateImportRateCatalogs(current.value.id, selected.value)
    await load()
    toastStore.success(
      'Catálogos validados',
      'Pricing volvió a comprobar cada selección directamente contra Config.',
    )
    await props.onUpdated?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron validar las correcciones contra Config.')
  } finally {
    saving.value = false
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

      <section
        v-if="current.status === 'Pending' && props.canEdit"
        class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="font-black text-[var(--dh-text)]">Corregir con datos de Config</h3>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              El POD oficial se selecciona aquí manualmente. Ningún valor detectado crea un catálogo
              nuevo.
            </p>
          </div>
          <DhButton
            label="Guardar y validar"
            :icon="Save"
            size="sm"
            :loading="saving"
            :disabled="!canSaveCatalogs"
            @click="saveCatalogs"
          />
        </div>

        <div
          v-if="unresolvedLabels.length"
          class="mt-4 rounded-[20px] border border-amber-500/20 bg-amber-500/10 px-4 py-3"
        >
          <p
            class="text-xs font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300"
          >
            Pendientes de concordancia
          </p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-soft)]">
            {{ unresolvedLabels.join(', ') }}
          </p>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DhSelect
            v-model="selected.importProfileId"
            label="Perfil de importación"
            :options="catalogs.profileOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.polId"
            label="POL"
            :options="catalogs.polOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.poeId"
            label="POE importado"
            :options="catalogs.poeOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.podId"
            label="POD oficial (manual)"
            :options="catalogs.podOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.carrierId"
            label="Naviera"
            :options="catalogs.carrierOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.agentId"
            label="Agente"
            :options="catalogs.agentOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.containerTypeId"
            label="Contenedor"
            :options="catalogs.containerOptions.value"
            placeholder="Seleccione"
          />
          <DhSelect
            v-model="selected.currencyId"
            label="Moneda"
            :options="catalogs.currencyOptions.value"
            placeholder="Seleccione"
          />
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
            {{
              current.hasConfigConcordance
                ? 'Todos los catálogos tienen concordancia con Config. Confirme montos y vigencia antes de aprobar.'
                : 'La aprobación está bloqueada hasta corregir todos los catálogos pendientes.'
            }}
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
