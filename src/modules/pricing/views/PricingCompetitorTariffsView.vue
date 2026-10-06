<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { BarChart3, Eye, FilePlus2, Trash2, Upload } from 'lucide-vue-next'
import { DhButton, DhInput, DhMultiSelect, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { PricingService } from '@/core/services/pricingService'
import { StorageService } from '@/core/services/storageService'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import type {
  CompetitorRateObservationDto,
  CompetitorTariffDto,
  ShipmentMode,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingCompetitorTariffFileModal from '@/modules/pricing/components/PricingCompetitorTariffFileModal.vue'

type ImportForm = {
  competitorCompanyName: string
  incotermId: string
  shipmentMode: ShipmentMode | ''
  validFrom: string
  validTo: string
  file: File | null
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<CompetitorTariffDto[]>([])
const loading = ref(false)
const saving = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filtersOpen = ref(true)
const formOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedStorageId = ref<string | null>(null)
const deleteTarget = ref<CompetitorTariffDto | null>(null)

const observationsOpen = ref(false)
const observationsLoading = ref(false)
const observations = ref<CompetitorRateObservationDto[]>([])
const observationTariff = ref<CompetitorTariffDto | null>(null)

const filters = reactive({
  search: '',
  shipmentModes: [] as string[],
  importStatuses: [] as string[],
  validOn: '',
})

const form = reactive<ImportForm>(blankForm())

const shipmentModeOptions = [
  { value: 'Fcl', label: 'FCL' },
  { value: 'Lcl', label: 'LCL' },
  { value: 'Ftl', label: 'FTL' },
  { value: 'Ltl', label: 'LTL' },
  { value: 'Air', label: 'Aéreo' },
  { value: 'AirConsol', label: 'Aéreo consolidado' },
]

const importStatusOptions = [
  { value: 'Processed', label: 'Procesado' },
  { value: 'ReviewRequired', label: 'Requiere revisión' },
  { value: 'Processing', label: 'Procesando' },
  { value: 'Failed', label: 'Falló' },
  { value: 'Legacy', label: 'Legado' },
]

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const columns: DhTableColumn<CompetitorTariffDto>[] = [
  { key: 'source', label: 'Fuente' },
  { key: 'file', label: 'Archivo' },
  { key: 'shipmentMode', label: 'Modalidad', align: 'center' },
  { key: 'observations', label: 'Tarifas', align: 'center' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'actions', label: '', align: 'right', width: '280px' },
]

const observationColumns: DhTableColumn<CompetitorRateObservationDto>[] = [
  { key: 'route', label: 'Ruta' },
  { key: 'carrier', label: 'Naviera' },
  { key: 'equipment', label: 'Equipo' },
  { key: 'amount', label: 'Monto comparable', align: 'right' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'status', label: 'Average', align: 'center' },
]

function blankForm(): ImportForm {
  return {
    competitorCompanyName: '',
    incotermId: '',
    shipmentMode: '',
    validFrom: '',
    validTo: '',
    file: null,
  }
}

function resetForm() {
  Object.assign(form, blankForm())
  if (fileInput.value) fileInput.value.value = ''
}

function openCreate() {
  resetForm()
  formOpen.value = true
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  form.file = input.files?.[0] ?? null
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(date)
}

function formatMoney(value?: number | null, currency?: string | null) {
  if (value == null) return '—'
  const code = String(currency || 'USD').trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 2,
      }).format(value)
    } catch {
      // Continúa con formato numérico.
    }
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}

function modeLabel(value: string) {
  return shipmentModeOptions.find((option) => option.value === value)?.label ?? value
}

function statusLabel(value?: string | null) {
  switch (value) {
    case 'Processed':
      return 'Procesado'
    case 'ReviewRequired':
      return 'Requiere revisión'
    case 'Processing':
      return 'Procesando'
    case 'Failed':
      return 'Falló'
    case 'Legacy':
      return 'Legado'
    default:
      return value || 'Sin estado'
  }
}

function statusClasses(value?: string | null) {
  switch (value) {
    case 'Processed':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    case 'ReviewRequired':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    case 'Failed':
      return 'border-red-500/30 bg-red-500/10 text-red-300'
    case 'Processing':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
    default:
      return 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)]'
  }
}

function routeLabel(row: CompetitorRateObservationDto) {
  return [row.polName || row.polCode, row.poeName || row.poeCode, row.podName || row.podCode]
    .filter(Boolean)
    .join(' → ') || 'Ruta sin normalizar'
}

function validOnValue() {
  return filters.validOn ? filters.validOn + 'T12:00:00Z' : undefined
}

async function load() {
  loading.value = true
  try {
    const response = await PricingService.browseCompetitorTariffs({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: filters.search.trim() || undefined,
      shipmentMode: filters.shipmentModes as ShipmentMode[],
      importStatus: filters.importStatuses,
      validOn: validOnValue(),
    })
    rows.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) {
    rows.value = []
    total.value = 0
    toastStore.backendError(error, 'No se pudieron cargar los tarifarios de la competencia.')
  } finally {
    loading.value = false
  }
}

function validateForm() {
  if (!form.competitorCompanyName.trim()) {
    toastStore.error('Fuente requerida', 'Indique el competidor o la fuente del tarifario.')
    return false
  }

  if (!form.incotermId) {
    toastStore.error('Incoterm requerido', 'Seleccione el Incoterm para que Average pueda comparar las tarifas.')
    return false
  }

  if (!form.shipmentMode) {
    toastStore.error('Modalidad requerida', 'Seleccione la modalidad del tarifario.')
    return false
  }

  if ((form.validFrom && !form.validTo) || (!form.validFrom && form.validTo)) {
    toastStore.error(
      'Vigencia incompleta',
      'Si usa una vigencia general, complete tanto la fecha desde como la fecha hasta.',
    )
    return false
  }

  if (form.validFrom && form.validTo && form.validTo < form.validFrom) {
    toastStore.error('Vigencia inválida', 'La vigencia hasta no puede ser anterior a la vigencia desde.')
    return false
  }

  if (!form.file) {
    toastStore.error('Archivo requerido', 'Adjunte el tarifario de la competencia.')
    return false
  }

  return true
}

async function importTariff() {
  if (!validateForm() || !form.file) return

  saving.value = true
  const id = crypto.randomUUID()
  let uploadedStorageId: string | null = null

  try {
    const stored = await StorageService.uploadFile({
      file: form.file,
      sourceService: 'DholePricingService',
      entityType: 'CompetitorTariff',
      entityId: id,
      metadataJson: JSON.stringify({
        purpose: 'competitor-tariff',
        competitorCompanyName: form.competitorCompanyName.trim(),
        shipmentMode: form.shipmentMode,
      }),
    })

    uploadedStorageId = stored.id

    const result = await PricingService.importCompetitorTariff({
      id,
      competitorCompanyName: form.competitorCompanyName.trim(),
      incotermId: form.incotermId,
      shipmentMode: form.shipmentMode as ShipmentMode,
      storageId: stored.id,
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
      file: form.file,
    })

    const detail = result.reviewCount > 0
      ? result.observationCount + ' tarifas extraídas; ' + result.reviewCount + ' requieren revisión.'
      : result.observationCount + ' tarifas extraídas y disponibles para Average.'

    toastStore.success('Tarifario procesado', detail)
    formOpen.value = false
    resetForm()
    await load()

    if (result.observationCount > 0 || result.reviewCount > 0) {
      await openObservations(result)
    }
  } catch (error) {
    if (uploadedStorageId) {
      try {
        await StorageService.deleteFile(uploadedStorageId)
      } catch {
        // Mantener el error original. Storage puede denegar el borrado según el scope.
      }
    }
    toastStore.backendError(error, 'No se pudo importar el tarifario de la competencia.')
  } finally {
    saving.value = false
  }
}

async function openObservations(row: CompetitorTariffDto) {
  observationTariff.value = row
  observations.value = []
  observationsOpen.value = true
  observationsLoading.value = true

  try {
    observations.value = await PricingService.getCompetitorTariffObservations(row.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las tarifas extraídas.')
  } finally {
    observationsLoading.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await PricingService.deleteCompetitorTariff(deleteTarget.value.id)
    toastStore.success(
      'Tarifario eliminado',
      'Las observaciones asociadas dejaron de participar en Average.',
    )
    deleteTarget.value = null
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el tarifario de la competencia.')
  }
}

watch([page, pageSize], () => void load())
watch(
  filters,
  () => {
    if (page.value !== 1) page.value = 1
    else void load()
  },
  { deep: true },
)

onMounted(async () => {
  await catalogs.loadAll()
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Tarifas competencia"
      subtitle="Importe tarifarios externos. Dhole extrae observaciones comparables y las usa para alimentar Average."
      :icon="BarChart3"
    >
      <template #actions>
        <DhButton label="Filtros" variant="secondary" @click="filtersOpen = !filtersOpen" />
        <DhButton
          v-if="canCreate"
          label="Importar tarifario"
          :icon="FilePlus2"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <section
      v-if="filtersOpen"
      class="relative z-10 grid gap-3 rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] md:grid-cols-2 xl:grid-cols-4"
    >
      <DhInput
        v-model="filters.search"
        label="Competidor o archivo"
        placeholder="Buscar fuente o archivo..."
      />
      <DhMultiSelect
        v-model="filters.shipmentModes"
        label="Modalidad"
        :options="shipmentModeOptions"
      />
      <DhMultiSelect
        v-model="filters.importStatuses"
        label="Estado"
        :options="importStatusOptions"
      />
      <DhInput v-model="filters.validOn" type="date" label="Vigente al" />
    </section>

    <DhDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="No hay tarifarios de competencia importados."
    >
      <template #cell-source="{ row }">
        <div class="min-w-0">
          <p class="font-black text-[var(--dh-text)]">
            {{ row.competitorCompanyName || 'Competencia' }}
          </p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Importado {{ formatDate(row.importedAtUtc) }}
          </p>
        </div>
      </template>

      <template #cell-file="{ row }">
        <div class="max-w-[320px]">
          <p class="truncate font-semibold">
            {{ row.originalFileName || 'Tarifario registrado manualmente' }}
          </p>
          <p v-if="row.incotermId" class="mt-1 text-xs text-[var(--dh-text-muted)]">
            Incoterm:
            {{
              catalogs.incoterms.value.find((item) => item.id === row.incotermId)?.name
                || catalogs.incoterms.value.find((item) => item.id === row.incotermId)?.code
                || 'Configurado'
            }}
          </p>
        </div>
      </template>

      <template #cell-shipmentMode="{ row }">
        <span class="font-black uppercase">{{ modeLabel(row.shipmentMode) }}</span>
      </template>

      <template #cell-observations="{ row }">
        <div class="text-center">
          <p class="text-lg font-black">{{ row.observationCount ?? 0 }}</p>
          <p
            v-if="row.reviewCount"
            class="text-xs font-bold text-amber-300"
          >
            {{ row.reviewCount }} por revisar
          </p>
          <p v-else class="text-xs font-semibold text-[var(--dh-text-muted)]">
            observaciones
          </p>
        </div>
      </template>

      <template #cell-status="{ row }">
        <span
          class="inline-flex rounded-full border px-2.5 py-1 text-xs font-black"
          :class="statusClasses(row.importStatus)"
        >
          {{ statusLabel(row.importStatus) }}
        </span>
      </template>

      <template #cell-validity="{ row }">
        {{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1.5" @click.stop>
          <DhButton
            label="Tarifas"
            :icon="BarChart3"
            size="sm"
            variant="secondary"
            @click="openObservations(row)"
          />
          <DhButton
            label="Archivo"
            :icon="Eye"
            size="sm"
            variant="secondary"
            @click="selectedStorageId = row.storageId"
          />
          <DhButton
            v-if="canDelete"
            :icon="Trash2"
            size="sm"
            variant="ghost"
            @click="deleteTarget = row"
          />
        </div>
      </template>
    </DhDataTable>

    <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
  </div>

  <DhModal
    :open="formOpen"
    title="Importar tarifario de competencia"
    size="xl"
    @close="formOpen = false"
  >
    <div class="space-y-5">
      <div
        class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm font-semibold text-[var(--dh-text-soft)]"
      >
        No hace falta escoger POL, POE, POD ni naviera. DataExtraction los obtiene del archivo
        y cada fila válida se guarda como una observación independiente para Average.
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.competitorCompanyName"
          label="Competidor / fuente"
          placeholder="Ej. Competidor A, DHL, Expeditors..."
        />
        <DhSelect
          v-model="form.incotermId"
          label="Incoterm"
          :options="catalogs.incotermOptions.value"
        />
        <DhSelect
          v-model="form.shipmentMode"
          label="Modalidad"
          :options="shipmentModeOptions"
        />
        <div class="hidden md:block" />
        <DhInput v-model="form.validFrom" type="date" label="Vigencia general desde (opcional)" />
        <DhInput v-model="form.validTo" type="date" label="Vigencia general hasta (opcional)" />
      </div>

      <div
        class="rounded-[24px] border border-dashed border-[var(--dh-border-strong)] bg-[var(--dh-card)] p-4"
      >
        <input
          ref="fileInput"
          class="hidden"
          type="file"
          accept=".pdf,.csv,.xls,.xlsx,.xlsm,.xlsb,.doc,.docx,.txt,.eml,.png,.jpg,.jpeg"
          @change="onFileSelected"
        />
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="font-black">Archivo del tarifario</p>
            <p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ form.file?.name || 'PDF, XLSX, CSV y otros documentos' }}
            </p>
          </div>
          <DhButton
            label="Seleccionar archivo"
            :icon="Upload"
            variant="secondary"
            @click="fileInput?.click()"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <DhButton label="Cancelar" variant="secondary" @click="formOpen = false" />
        <DhButton
          label="Importar y extraer"
          :loading="saving"
          @click="importTariff"
        />
      </div>
    </div>
  </DhModal>

  <DhModal
    :open="observationsOpen"
    :title="'Tarifas extraídas · ' + (observationTariff?.competitorCompanyName || 'Competencia')"
    size="xl"
    @close="observationsOpen = false"
  >
    <div class="space-y-4">
      <div
        v-if="observationTariff"
        class="grid gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm md:grid-cols-3"
      >
        <div>
          <p class="text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Archivo</p>
          <p class="mt-1 break-all font-bold">{{ observationTariff.originalFileName || '—' }}</p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Observaciones</p>
          <p class="mt-1 font-bold">{{ observationTariff.observationCount ?? 0 }}</p>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Por revisar</p>
          <p class="mt-1 font-bold">{{ observationTariff.reviewCount ?? 0 }}</p>
        </div>
      </div>

      <DhDataTable
        :columns="observationColumns"
        :rows="observations"
        :loading="observationsLoading"
        empty-text="Este tarifario todavía no tiene observaciones individuales. Si es un registro legado, elimínelo y vuelva a importarlo."
      >
        <template #cell-route="{ row }">
          <div class="max-w-[360px]">
            <p class="font-bold">{{ routeLabel(row) }}</p>
            <p v-if="row.incotermCode" class="mt-1 text-xs text-[var(--dh-text-muted)]">
              {{ row.incotermCode }}
            </p>
          </div>
        </template>

        <template #cell-carrier="{ row }">
          {{ row.carrierName || row.carrierCode || 'Sin normalizar' }}
        </template>

        <template #cell-equipment="{ row }">
          {{ row.containerTypeCode || '—' }}
        </template>

        <template #cell-amount="{ row }">
          <div class="text-right">
            <p class="font-black">
              {{ formatMoney(row.normalizedAmount, row.normalizedCurrency || 'USD') }}
            </p>
            <p
              v-if="row.originalAmount != null"
              class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              Original: {{ formatMoney(row.originalAmount, row.currency) }}
            </p>
          </div>
        </template>

        <template #cell-validity="{ row }">
          {{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}
        </template>

        <template #cell-status="{ row }">
          <span
            v-if="row.isUsable"
            class="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-300"
          >
            Lista para Average
          </span>
          <span
            v-else
            class="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-300"
          >
            Revisar
          </span>
        </template>
      </DhDataTable>
    </div>
  </DhModal>

  <DhModal
    :open="Boolean(deleteTarget)"
    title="Eliminar tarifario de competencia"
    size="sm"
    @close="deleteTarget = null"
  >
    <p class="text-sm font-semibold text-[var(--dh-text-soft)]">
      Se eliminará el registro y todas sus observaciones de mercado. Dejarán de participar
      inmediatamente en los cálculos de Average. El archivo de Storage se conserva para trazabilidad.
    </p>
    <div class="mt-5 flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="deleteTarget = null" />
      <DhButton label="Eliminar" variant="danger" @click="confirmDelete" />
    </div>
  </DhModal>

  <PricingCompetitorTariffFileModal
    :open="Boolean(selectedStorageId)"
    :storage-id="selectedStorageId"
    @close="selectedStorageId = null"
  />
</template>
