<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { BarChart3, Eye, FilePlus2, Pencil, Trash2, Upload } from 'lucide-vue-next'
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

type ReviewForm = {
  incotermId: string
  polId: string
  poeId: string
  podId: string
  carrierId: string
  containerTypeId: string
  currencyId: string
  originalAmount: string
  validFrom: string
  validTo: string
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

const reviewOpen = ref(false)
const reviewSaving = ref(false)
const reviewTarget = ref<CompetitorRateObservationDto | null>(null)
const reviewForm = reactive<ReviewForm>({
  incotermId: '',
  polId: '',
  poeId: '',
  podId: '',
  carrierId: '',
  containerTypeId: '',
  currencyId: '',
  originalAmount: '',
  validFrom: '',
  validTo: '',
})

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
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const reviewEquipmentOptions = computed(() => {
  const mode = reviewTarget.value?.shipmentMode
  if (mode === 'Ftl' || mode === 'Ltl') return catalogs.landEquipmentOptions.value
  return catalogs.containerOptions.value
})

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
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function incotermLabel(row: CompetitorRateObservationDto) {
  const item = catalogs.incoterms.value.find((candidate) => candidate.id === row.incotermId)
  return item?.value || item?.name || row.incotermCode || '—'
}

function observationReviewReason(row: CompetitorRateObservationDto) {
  const reasons: string[] = []
  if (row.extractionConfidence === 0) reasons.push('Datos provisionales: confirme moneda y vigencia')
  if (!row.incotermId) reasons.push('Incoterm sin normalizar')
  if (!row.polId) reasons.push('POL sin normalizar')
  if (!row.normalizedAmount) reasons.push('Monto comparable sin normalizar')
  if (row.shipmentMode === 'Fcl' || row.shipmentMode === 'Ftl') {
    if (!row.containerTypeId) reasons.push('Equipo sin normalizar')
  }
  if (!row.normalizedCurrency || row.normalizedCurrency.toUpperCase() !== 'USD') {
    reasons.push('Moneda pendiente de normalización')
  }
  return reasons.join(' · ') || 'Revise los datos detectados antes de usar esta tarifa en Average.'
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

function canonicalCurrencyToken(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

  const dollar = String.fromCharCode(36)
  const colonSign = String.fromCharCode(8353)
  const euroSign = String.fromCharCode(8364)
  const poundSign = String.fromCharCode(163)

  if (
    normalized.includes(dollar)
    || ['USD', 'US DOLLAR', 'US DOLLARS', 'DOLLAR', 'DOLLARS', 'DOLAR', 'DOLARES'].includes(normalized)
  ) return 'USD'

  if (
    normalized.includes(colonSign)
    || ['CRC', 'COLON', 'COLONES', 'COSTA RICAN COLON'].includes(normalized)
  ) return 'CRC'

  if (normalized.includes(euroSign) || ['EUR', 'EURO', 'EUROS'].includes(normalized)) return 'EUR'
  if (normalized.includes(poundSign) || ['GBP', 'POUND', 'POUNDS', 'STERLING'].includes(normalized)) return 'GBP'

  return /^[A-Z]{3}$/.test(normalized) ? normalized : normalized
}

function resolveReviewCurrencyId(row: CompetitorRateObservationDto) {
  const expected = canonicalCurrencyToken(row.normalizedCurrency || row.currency)
  if (!expected) return ''

  return catalogs.currencies.value.find((item) =>
    [item.code, item.value, item.name]
      .filter(Boolean)
      .some((value) => canonicalCurrencyToken(String(value)) === expected),
  )?.id || ''
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

  const extension = form.file.name.toLowerCase().split('.').pop()
  if (!['pdf', 'csv', 'xls', 'xlsx', 'xlsm'].includes(extension || '')) {
    toastStore.error('Formato no soportado', 'Use PDF, XLSX, XLS, XLSM o CSV. Los demás formatos no se extraen para Average.')
    return false
  }

  return true
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
}

function replaceRow(updated: CompetitorTariffDto) {
  const index = rows.value.findIndex((row) => row.id === updated.id)
  if (index >= 0) {
    rows.value.splice(index, 1, updated)
  }
}

async function monitorImport(competitorTariffId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(3000)

    try {
      const detail = await PricingService.getCompetitorTariff(competitorTariffId)
      replaceRow(detail)

      if (detail.importStatus === 'Processing') continue

      if (detail.importStatus === 'Failed') {
        toastStore.error(
          'No se pudo procesar el tarifario',
          'El archivo sí fue recibido, pero DataExtraction no pudo completar la extracción. Puede revisar el registro o volver a intentarlo.',
        )
        return
      }

      const message = detail.reviewCount > 0
        ? detail.observationCount + ' tarifas extraídas; ' + detail.reviewCount + ' requieren revisión.'
        : detail.observationCount + ' tarifas extraídas y disponibles para Average.'

      toastStore.success('Tarifario procesado', message)
      await load()
      return
    } catch {
      // Un fallo transitorio al consultar el estado no debe cancelar la extracción.
    }
  }

  toastStore.warning(
    'Importación todavía en proceso',
    'Dhole sigue procesando el archivo en segundo plano. El estado se actualizará al recargar la lista.',
  )
  await load()
}

async function importTariff() {
  if (!validateForm() || !form.file) return

  saving.value = true
  const id = crypto.randomUUID()
  const requestSnapshot = {
    competitorCompanyName: form.competitorCompanyName.trim(),
    incotermId: form.incotermId,
    shipmentMode: form.shipmentMode as ShipmentMode,
    validFrom: form.validFrom || undefined,
    validTo: form.validTo || undefined,
    file: form.file,
  }
  let storageId = ''

  async function acceptImport(result: CompetitorTariffDto, recovered = false) {
    formOpen.value = false
    resetForm()
    await load()

    if (result.importStatus === 'Processing') {
      toastStore.success(
        recovered ? 'Importación recuperada' : 'Importación iniciada',
        recovered
          ? 'Pricing volvió a estar disponible y confirmó que el archivo fue recibido. DataExtraction continuará en segundo plano.'
          : 'El archivo ya fue recibido. DataExtraction continuará en segundo plano y puede seguir usando Dhole mientras termina.',
      )
      void monitorImport(result.id)
      return
    }

    const detail = result.reviewCount > 0
      ? result.observationCount + ' tarifas extraídas; ' + result.reviewCount + ' requieren revisión.'
      : result.observationCount + ' tarifas extraídas y disponibles para Average.'

    toastStore.success('Tarifario procesado', detail)

    if (result.observationCount > 0 || result.reviewCount > 0) {
      await openObservations(result)
    }
  }

  try {
    const stored = await StorageService.uploadFile({
      file: requestSnapshot.file,
      sourceService: 'DholePricingService',
      entityType: 'CompetitorTariff',
      entityId: id,
      metadataJson: JSON.stringify({
        purpose: 'competitor-tariff',
        competitorCompanyName: requestSnapshot.competitorCompanyName,
        shipmentMode: requestSnapshot.shipmentMode,
      }),
    })
    storageId = stored.id

    const result = await PricingService.importCompetitorTariff({
      id,
      ...requestSnapshot,
      storageId,
    })

    await acceptImport(result)
  } catch (error) {
    // A production deploy can make the API origin unavailable for a few seconds.
    // Do not immediately show the user a Cloudflare/Gateway 502. First verify
    // whether the import reached Pricing using the client-generated id.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(3000)

      try {
        const persisted = await PricingService.getCompetitorTariff(id)
        await acceptImport(persisted, true)
        return
      } catch {
        // Keep polling while the API/origin comes back.
      }
    }

    // If Pricing never saw the first POST, retry it once with the same id.
    // The backend treats this id as an idempotency key, so a lost response
    // cannot create a duplicate import.
    if (storageId) {
      try {
        const retried = await PricingService.importCompetitorTariff({
          id,
          ...requestSnapshot,
          storageId,
        })
        await acceptImport(retried, true)
        return
      } catch {
        // Fall through to the original error only after recovery was exhausted.
      }
    }

    toastStore.backendError(
      error,
      'Pricing no estuvo disponible para recibir el tarifario. Dhole intentó recuperarse automáticamente antes de mostrar este error.',
    )
  } finally {
    saving.value = false
  }
}

function openReview(row: CompetitorRateObservationDto) {
  reviewTarget.value = row

  const currencyId = resolveReviewCurrencyId(row)

  Object.assign(reviewForm, {
    incotermId: row.incotermId || observationTariff.value?.incotermId || '',
    polId: row.polId || '',
    poeId: row.poeId || '',
    podId: row.podId || '',
    carrierId: row.carrierId || '',
    containerTypeId: row.containerTypeId || '',
    currencyId,
    originalAmount: String(row.originalAmount ?? row.normalizedAmount ?? ''),
    validFrom: toDateInput(row.validFrom),
    validTo: toDateInput(row.validTo),
  })

  reviewOpen.value = true
}

async function saveReview() {
  if (!reviewTarget.value || !observationTariff.value) return

  if (!reviewForm.incotermId || !reviewForm.polId || !reviewForm.currencyId) {
    toastStore.error(
      'Datos incompletos',
      'Incoterm, POL y moneda son obligatorios para revisar la tarifa.',
    )
    return
  }

  const originalAmount = Number(reviewForm.originalAmount)
  if (!Number.isFinite(originalAmount) || originalAmount < 0) {
    toastStore.error('Monto inválido', 'Indique el monto original de la tarifa.')
    return
  }

  if (!reviewForm.validFrom || !reviewForm.validTo || reviewForm.validTo < reviewForm.validFrom) {
    toastStore.error('Vigencia inválida', 'Revise las fechas de vigencia.')
    return
  }

  const currency = catalogs.currencies.value.find((item) => item.id === reviewForm.currencyId)
  const businessCurrency = currency?.value || currency?.name || currency?.code
  if (!businessCurrency) {
    toastStore.error('Moneda inválida', 'No se pudo resolver el valor de la moneda seleccionada.')
    return
  }

  reviewSaving.value = true
  try {
    const updated = await PricingService.reviewCompetitorTariffObservation(
      observationTariff.value.id,
      reviewTarget.value.id,
      {
        incotermId: reviewForm.incotermId,
        polId: reviewForm.polId,
        poeId: reviewForm.poeId || null,
        podId: reviewForm.podId || null,
        carrierId: reviewForm.carrierId || null,
        containerTypeId: reviewForm.containerTypeId || null,
        currency: businessCurrency,
        originalAmount,
        validFrom: reviewForm.validFrom,
        validTo: reviewForm.validTo,
      },
    )

    const index = observations.value.findIndex((row) => row.id === updated.id)
    if (index >= 0) observations.value.splice(index, 1, updated)

    const parent = await PricingService.getCompetitorTariff(observationTariff.value.id)
    observationTariff.value = parent
    replaceRow(parent)

    reviewOpen.value = false
    reviewTarget.value = null
    toastStore.success(
      updated.isUsable ? 'Tarifa revisada' : 'Revisión guardada',
      updated.isUsable
        ? 'La observación ya está disponible para Average.'
        : 'Los cambios se guardaron, pero todavía falta normalizar algún dato.',
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la revisión de la tarifa.')
  } finally {
    reviewSaving.value = false
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
              catalogs.incoterms.value.find((item) => item.id === row.incotermId)?.value
                || catalogs.incoterms.value.find((item) => item.id === row.incotermId)?.name
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
          accept=".pdf,.csv,.xls,.xlsx,.xlsm"
          @change="onFileSelected"
        />
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="font-black">Archivo del tarifario</p>
            <p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ form.file?.name || 'PDF, XLSX, XLS, XLSM o CSV' }}
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
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              {{ incotermLabel(row) }}
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
          <div v-else class="flex flex-col items-center gap-1">
            <DhButton
              v-if="canUpdate"
              label="Revisar"
              :icon="Pencil"
              size="sm"
              variant="secondary"
              @click="openReview(row)"
            />
            <span
              v-else
              class="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-300"
            >
              Requiere revisión
            </span>
            <p class="max-w-[220px] text-center text-[10px] font-semibold leading-tight text-[var(--dh-text-muted)]">
              {{ observationReviewReason(row) }}
            </p>
          </div>
        </template>
      </DhDataTable>
    </div>
  </DhModal>

  <DhModal
    :open="reviewOpen"
    title="Revisar tarifa de competencia"
    size="lg"
    @close="reviewOpen = false"
  >
    <div v-if="reviewTarget" class="space-y-5">
      <div
        class="rounded-[22px] border border-amber-500/25 bg-amber-500/5 p-4 text-sm font-semibold text-[var(--dh-text-soft)]"
      >
        <p class="font-black text-amber-300">Motivo de revisión</p>
        <p class="mt-1">{{ observationReviewReason(reviewTarget) }}</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <DhSelect
          v-model="reviewForm.incotermId"
          label="Incoterm"
          :options="catalogs.incotermOptions.value"
        />
        <DhSelect
          v-model="reviewForm.currencyId"
          label="Moneda"
          :options="catalogs.currencyOptions.value"
        />
        <DhSelect
          v-model="reviewForm.polId"
          label="POL"
          :options="catalogs.polOptions.value"
        />
        <DhSelect
          v-model="reviewForm.poeId"
          label="POE"
          :options="catalogs.poeOptions.value"
        />
        <DhSelect
          v-model="reviewForm.podId"
          label="POD"
          :options="catalogs.podOptions.value"
        />
        <DhSelect
          v-model="reviewForm.carrierId"
          label="Naviera"
          :options="catalogs.carrierOptions.value"
        />
        <DhSelect
          v-model="reviewForm.containerTypeId"
          label="Equipo"
          :options="reviewEquipmentOptions"
        />
        <DhInput
          v-model="reviewForm.originalAmount"
          type="number"
          min="0"
          step="0.01"
          label="Monto original"
        />
        <DhInput
          v-model="reviewForm.validFrom"
          type="date"
          label="Vigencia desde"
        />
        <DhInput
          v-model="reviewForm.validTo"
          type="date"
          label="Vigencia hasta"
        />
      </div>

      <div class="flex justify-end gap-2">
        <DhButton label="Cancelar" variant="secondary" @click="reviewOpen = false" />
        <DhButton
          label="Guardar revisión"
          :loading="reviewSaving"
          @click="saveReview"
        />
      </div>
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
