<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye, Scale } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal } from '@/shared/components/organisms'
import { PricingService } from '@/core/services/pricingService'
import type { CompetitorTariffDto, ShipmentMode } from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingCompetitorTariffFileModal from '@/modules/pricing/components/PricingCompetitorTariffFileModal.vue'

const props = defineProps<{
  open: boolean
  polId: string | null
  poeId: string | null
  podId: string | null
  carrierId: string | null
  shipmentMode: ShipmentMode | null
  validOn?: string | null
}>()

const emit = defineEmits<{ close: [] }>()
const catalogs = usePricingCatalogs()
const rows = ref<CompetitorTariffDto[]>([])
const loading = ref(false)
const error = ref('')
const selectedStorageId = ref<string | null>(null)

const columns: DhTableColumn<CompetitorTariffDto>[] = [
  { key: 'carrier', label: 'Naviera' },
  { key: 'route', label: 'POL · POE · POD' },
  { key: 'shipmentMode', label: 'Modalidad', align: 'center' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
]

function catalogNames(
  ids: string[],
  items: Array<{ id: string; name?: string; label?: string; code?: string }>,
) {
  return ids
    .map((id) => {
      const item = items.find((candidate) => candidate.id === id)
      return item?.name || item?.label || item?.code || id
    })
    .join(', ')
}

function carrierNames(row: CompetitorTariffDto) {
  return catalogNames(row.carrierIds, catalogs.carriers.value)
}

function routeText(row: CompetitorTariffDto) {
  const pol = catalogNames(row.polIds, catalogs.polPorts.value)
  const poe = catalogNames(row.poeIds, catalogs.poePorts.value)
  const pod = catalogNames(row.podIds, catalogs.podPorts.value)
  return `${pol} → ${poe} → ${pod}`
}

function date(value: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(value))
}

async function load() {
  if (!props.open) return

  if (!props.polId || !props.poeId || !props.podId || !props.carrierId || !props.shipmentMode) {
    rows.value = []
    error.value = 'Complete POL, POE, POD, naviera y modalidad antes de consultar la competencia.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    await catalogs.loadAll()
    rows.value = await PricingService.matchCompetitorTariffs({
      polId: props.polId,
      poeId: props.poeId,
      podId: props.podId,
      carrierId: props.carrierId,
      shipmentMode: props.shipmentMode,
      validOn: props.validOn ? `${props.validOn}T12:00:00Z` : undefined,
    })
  } catch {
    rows.value = []
    error.value = 'No se pudieron consultar las tarifas de la competencia.'
  } finally {
    loading.value = false
  }
}

watch(
  () => [
    props.open,
    props.polId,
    props.poeId,
    props.podId,
    props.carrierId,
    props.shipmentMode,
    props.validOn,
  ] as const,
  () => void load(),
  { immediate: true },
)
</script>

<template>
  <DhModal :open="open" title="Tarifas de la competencia" size="xl" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex items-start gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
          <Scale class="h-5 w-5" />
        </div>
        <div>
          <p class="font-black">Comparación contextual</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Se muestran tarifarios vigentes que coinciden con POL, POE, POD, naviera y modalidad de esta tarifa.
          </p>
        </div>
      </div>

      <p
        v-if="error"
        class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-200"
      >
        {{ error }}
      </p>

      <DhDataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        empty-text="No hay tarifas de la competencia vigentes para esta ruta."
      >
        <template #cell-carrier="{ row }">
          <span class="font-bold">{{ carrierNames(row) }}</span>
        </template>

        <template #cell-route="{ row }">
          <span class="font-semibold">{{ routeText(row) }}</span>
        </template>

        <template #cell-shipmentMode="{ row }">
          <span class="font-black uppercase">{{ row.shipmentMode }}</span>
        </template>

        <template #cell-validity="{ row }">
          <span>{{ date(row.validFrom) }} – {{ date(row.validTo) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <DhButton
            label="Ver"
            :icon="Eye"
            size="sm"
            variant="secondary"
            @click.stop="selectedStorageId = row.storageId"
          />
        </template>
      </DhDataTable>
    </div>
  </DhModal>

  <PricingCompetitorTariffFileModal
    :open="Boolean(selectedStorageId)"
    :storage-id="selectedStorageId"
    @close="selectedStorageId = null"
  />
</template>
