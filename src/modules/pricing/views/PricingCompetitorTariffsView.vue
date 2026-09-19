<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Eye, FilePlus2, Pencil, Trash2, Upload } from 'lucide-vue-next'
import { DhButton, DhInput, DhMultiSelect, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { PricingService } from '@/core/services/pricingService'
import { StorageService } from '@/core/services/storageService'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import type {
  CompetitorTariffDto,
  ShipmentMode,
  UpsertCompetitorTariffRequest,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingCompetitorTariffFileModal from '@/modules/pricing/components/PricingCompetitorTariffFileModal.vue'

type TariffForm = {
  id: string
  polIds: string[]
  poeIds: string[]
  podIds: string[]
  carrierIds: string[]
  validFrom: string
  validTo: string
  shipmentMode: ShipmentMode | ''
  storageId: string
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
const editing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedStorageId = ref<string | null>(null)
const deleteTarget = ref<CompetitorTariffDto | null>(null)

const filters = reactive({
  polIds: [] as string[],
  poeIds: [] as string[],
  podIds: [] as string[],
  carrierIds: [] as string[],
  shipmentModes: [] as string[],
  validOn: '',
})

const form = reactive<TariffForm>(blankForm())

const shipmentModeOptions = [
  { value: 'Fcl', label: 'FCL' },
  { value: 'Lcl', label: 'LCL' },
  { value: 'Ftl', label: 'FTL' },
  { value: 'Ltl', label: 'LTL' },
]

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const columns: DhTableColumn<CompetitorTariffDto>[] = [
  { key: 'carrier', label: 'Navieras' },
  { key: 'pol', label: 'POL' },
  { key: 'poe', label: 'POE' },
  { key: 'pod', label: 'POD' },
  { key: 'shipmentMode', label: 'Modalidad', align: 'center' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'actions', label: '', align: 'right', width: '210px' },
]

function blankForm(): TariffForm {
  return {
    id: '',
    polIds: [],
    poeIds: [],
    podIds: [],
    carrierIds: [],
    validFrom: '',
    validTo: '',
    shipmentMode: '',
    storageId: '',
    file: null,
  }
}

function resetForm() {
  Object.assign(form, blankForm())
  if (fileInput.value) fileInput.value.value = ''
}

function openCreate() {
  resetForm()
  form.id = crypto.randomUUID()
  editing.value = false
  formOpen.value = true
}

function openEdit(row: CompetitorTariffDto) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    polIds: [...row.polIds],
    poeIds: [...row.poeIds],
    podIds: [...row.podIds],
    carrierIds: [...row.carrierIds],
    validFrom: row.validFrom.slice(0, 10),
    validTo: row.validTo.slice(0, 10),
    shipmentMode: row.shipmentMode,
    storageId: row.storageId,
    file: null,
  })
  editing.value = true
  formOpen.value = true
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  form.file = input.files?.[0] ?? null
}

function labels(
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(value))
}

function validOnValue() {
  return filters.validOn ? `${filters.validOn}T12:00:00Z` : undefined
}

async function load() {
  loading.value = true
  try {
    const response = await PricingService.browseCompetitorTariffs({
      pageNumber: page.value,
      pageSize: pageSize.value,
      polId: filters.polIds,
      poeId: filters.poeIds,
      podId: filters.podIds,
      carrierId: filters.carrierIds,
      shipmentMode: filters.shipmentModes as ShipmentMode[],
      validOn: validOnValue(),
    })
    rows.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) {
    rows.value = []
    total.value = 0
    toastStore.backendError(error, 'No se pudieron cargar las tarifas de la competencia.')
  } finally {
    loading.value = false
  }
}

function validateForm() {
  if (!form.polIds.length || !form.poeIds.length || !form.podIds.length || !form.carrierIds.length) {
    toastStore.error('Datos incompletos', 'Seleccione al menos un POL, POE, POD y naviera.')
    return false
  }

  if (!form.validFrom || !form.validTo || !form.shipmentMode) {
    toastStore.error('Datos incompletos', 'Complete vigencia y modalidad.')
    return false
  }

  if (form.validTo < form.validFrom) {
    toastStore.error('Vigencia inválida', 'La vigencia hasta no puede ser anterior a la vigencia desde.')
    return false
  }

  if (!form.file && !form.storageId) {
    toastStore.error('Archivo requerido', 'Adjunte el tarifario de la competencia.')
    return false
  }

  return true
}

async function save() {
  if (!validateForm()) return

  saving.value = true
  let uploadedStorageId: string | null = null
  try {
    if (form.file) {
      const stored = await StorageService.uploadFile({
        file: form.file,
        sourceService: 'DholePricingService',
        entityType: 'CompetitorTariff',
        entityId: form.id,
        metadataJson: JSON.stringify({ purpose: 'competitor-tariff' }),
      })
      form.storageId = stored.id
      uploadedStorageId = stored.id
    }

    const payload: UpsertCompetitorTariffRequest = {
      id: form.id,
      polIds: [...form.polIds],
      poeIds: [...form.poeIds],
      podIds: [...form.podIds],
      carrierIds: [...form.carrierIds],
      validFrom: `${form.validFrom}T00:00:00Z`,
      validTo: `${form.validTo}T23:59:59.999Z`,
      shipmentMode: form.shipmentMode as ShipmentMode,
      storageId: form.storageId,
    }

    if (editing.value) {
      await PricingService.updateCompetitorTariff(form.id, payload)
    } else {
      await PricingService.createCompetitorTariff(payload)
    }

    toastStore.success(
      editing.value ? 'Tarifario actualizado' : 'Tarifario creado',
      'La tarifa de la competencia quedó disponible para análisis y comparación.',
    )
    formOpen.value = false
    await load()
  } catch (error) {
    if (uploadedStorageId && !editing.value) {
      try {
        await StorageService.deleteFile(uploadedStorageId)
      } catch {
        // Mantener el error original. Storage puede denegar el borrado según el scope del usuario.
      }
    }
    toastStore.backendError(error, 'No se pudo guardar el tarifario de la competencia.')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await PricingService.deleteCompetitorTariff(deleteTarget.value.id)
    toastStore.success('Tarifario eliminado')
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
      subtitle="Guarde tarifarios externos y consúltelos por ruta, naviera, modalidad y vigencia."
      :icon="FilePlus2"
    >
      <template #actions>
        <DhButton label="Filtros" variant="secondary" @click="filtersOpen = !filtersOpen" />
        <DhButton
          v-if="canCreate"
          label="Nuevo tarifario"
          :icon="FilePlus2"
          @click="openCreate"
        />
      </template>
    </DhPageHeader>

    <section
      v-if="filtersOpen"
      class="relative z-10 grid gap-3 rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] md:grid-cols-2 xl:grid-cols-6"
    >
      <DhMultiSelect v-model="filters.polIds" label="POL" :options="catalogs.polOptions.value" search-placeholder="Buscar POL..." />
      <DhMultiSelect v-model="filters.poeIds" label="POE" :options="catalogs.poeOptions.value" search-placeholder="Buscar POE..." />
      <DhMultiSelect v-model="filters.podIds" label="POD" :options="catalogs.podOptions.value" search-placeholder="Buscar POD..." />
      <DhMultiSelect v-model="filters.carrierIds" label="Naviera" :options="catalogs.carrierOptions.value" search-placeholder="Buscar naviera..." />
      <DhMultiSelect v-model="filters.shipmentModes" label="Modalidad" :options="shipmentModeOptions" />
      <DhInput v-model="filters.validOn" type="date" label="Vigente al" />
    </section>

    <DhDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      empty-text="No hay tarifas de la competencia registradas."
    >
      <template #cell-carrier="{ row }">
        {{ labels(row.carrierIds, catalogs.carriers.value) }}
      </template>
      <template #cell-pol="{ row }">
        {{ labels(row.polIds, catalogs.polPorts.value) }}
      </template>
      <template #cell-poe="{ row }">
        {{ labels(row.poeIds, catalogs.poePorts.value) }}
      </template>
      <template #cell-pod="{ row }">
        {{ labels(row.podIds, catalogs.podPorts.value) }}
      </template>
      <template #cell-shipmentMode="{ row }">
        <span class="font-black uppercase">{{ row.shipmentMode }}</span>
      </template>
      <template #cell-validity="{ row }">
        {{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1.5" @click.stop>
          <DhButton
            label="Ver"
            :icon="Eye"
            size="sm"
            variant="secondary"
            @click="selectedStorageId = row.storageId"
          />
          <DhButton
            v-if="canUpdate"
            :icon="Pencil"
            size="sm"
            variant="ghost"
            @click="openEdit(row)"
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
    :title="editing ? 'Editar tarifa competencia' : 'Nueva tarifa competencia'"
    size="xl"
    @close="formOpen = false"
  >
    <div class="space-y-5">
      <div class="grid gap-4 md:grid-cols-2">
        <DhMultiSelect v-model="form.polIds" label="POL" :options="catalogs.polOptions.value" search-placeholder="Buscar POL..." />
        <DhMultiSelect v-model="form.poeIds" label="POE" :options="catalogs.poeOptions.value" search-placeholder="Buscar POE..." />
        <DhMultiSelect v-model="form.podIds" label="POD" :options="catalogs.podOptions.value" search-placeholder="Buscar POD..." />
        <DhMultiSelect v-model="form.carrierIds" label="Navieras" :options="catalogs.carrierOptions.value" search-placeholder="Buscar naviera..." />
        <DhInput v-model="form.validFrom" type="date" label="Vigencia desde" />
        <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" />
        <DhSelect v-model="form.shipmentMode" label="Modalidad" :options="shipmentModeOptions" />
      </div>

      <div class="rounded-[24px] border border-dashed border-[var(--dh-border-strong)] bg-[var(--dh-card)] p-4">
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
              {{ form.file?.name || (form.storageId ? 'Archivo actual conservado' : 'PDF, XLSX, CSV y otros documentos') }}
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
          :label="editing ? 'Guardar cambios' : 'Crear tarifario'"
          :loading="saving"
          @click="save"
        />
      </div>
    </div>
  </DhModal>

  <DhModal
    :open="Boolean(deleteTarget)"
    title="Eliminar tarifa competencia"
    size="sm"
    @close="deleteTarget = null"
  >
    <p class="text-sm font-semibold text-[var(--dh-text-soft)]">
      Se eliminará el registro de Pricing. El archivo de Storage se conserva para trazabilidad.
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
