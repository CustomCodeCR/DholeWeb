<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Download, Plus, RefreshCw, Save, Truck, Upload } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type CreateLandTariffItem,
  type FtlTariffDto,
  type LandShipmentMode,
  type UpdateFtlTariffItem,
} from '@/core/services/ftlTariffService'

interface EditableLandTariff extends FtlTariffDto {
  priceInput: string
  minimumInput: string
  transitInput: string
  warehouseInput: string
  sourceInput: string
  notesInput: string
  validFromInput: string
  validToInput: string
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const creating = ref(false)
const showNewRate = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedMode = ref<LandShipmentMode>('Ftl')
const selectedEquipmentClass = ref('48_53')
const rows = ref<EditableLandTariff[]>([])
const currencies = ref<CatalogItemDto[]>([])
const originalValues = ref(new Map<string, string>())

const preferredLocationOrder = [
  'Costa Rica',
  'Nicaragua',
  'Tegucigalpa',
  'San Pedro Sula',
  'El Salvador',
  'Guatemala',
  'Panamá',
  'Ciudad Hidalgo',
]

const equipmentOptions = [
  { value: '48_53', label: 'Equipo 48/53 pies' },
  { value: '5_7_TON', label: 'Equipo 5 a 7 toneladas' },
]

const newRate = reactive({
  originName: '',
  originCode: '',
  destinationName: '',
  destinationCode: '',
  priceAmount: '',
  minimumAmount: '',
  transitDays: '',
  warehouseName: '',
  source: '',
  notes: '',
  validFrom: '',
  validTo: '',
})

const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))
const visibleRows = computed(() =>
  rows.value.filter((row) => {
    if (row.shipmentMode !== selectedMode.value) return false
    if (selectedMode.value === 'Ltl') return true
    return row.equipmentClass.toUpperCase() === selectedEquipmentClass.value
  }),
)

const locations = computed(() => {
  const names = new Set<string>()
  visibleRows.value.forEach((row) => {
    names.add(row.originName)
    names.add(row.destinationName)
  })
  return [...names].sort((left, right) => {
    const leftIndex = preferredLocationOrder.indexOf(left)
    const rightIndex = preferredLocationOrder.indexOf(right)
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1
      if (rightIndex < 0) return -1
      return leftIndex - rightIndex
    }
    return left.localeCompare(right, 'es')
  })
})

function findRate(originName: string, destinationName: string) {
  return visibleRows.value.find(
    (row) => row.originName === originName && row.destinationName === destinationName,
  )
}

function parsedNumber(value: string, nullable = false) {
  const normalized = value.trim()
  if (!normalized && nullable) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function editableSnapshot(row: EditableLandTariff) {
  return JSON.stringify({
    price: row.priceInput,
    minimum: row.minimumInput,
    transit: row.transitInput,
    warehouse: row.warehouseInput,
    source: row.sourceInput,
    notes: row.notesInput,
    validFrom: row.validFromInput,
    validTo: row.validToInput,
    active: row.isActive,
  })
}

function toEditable(row: FtlTariffDto): EditableLandTariff {
  return {
    ...row,
    priceInput: String(row.priceAmount),
    minimumInput: row.minimumAmount == null ? '' : String(row.minimumAmount),
    transitInput: row.transitDays == null ? '' : String(row.transitDays),
    warehouseInput: row.warehouseName ?? '',
    sourceInput: row.source ?? '',
    notesInput: row.notes ?? '',
    validFromInput: row.validFrom?.slice(0, 10) ?? '',
    validToInput: row.validTo?.slice(0, 10) ?? '',
  }
}

function isDirty(row: EditableLandTariff) {
  return editableSnapshot(row) !== originalValues.value.get(row.id)
}

const dirtyRows = computed(() => rows.value.filter(isDirty))

function validateDirtyRows() {
  for (const row of dirtyRows.value) {
    const price = parsedNumber(row.priceInput)
    const minimum = parsedNumber(row.minimumInput, true)
    const transit = parsedNumber(row.transitInput, true)
    if (!Number.isFinite(price) || price < 0) {
      toastStore.error('Precio inválido', `${row.originName} → ${row.destinationName} tiene un precio inválido.`)
      return false
    }
    if (minimum != null && (!Number.isFinite(minimum) || minimum < 0)) {
      toastStore.error('Mínimo inválido', `${row.originName} → ${row.destinationName} tiene un mínimo inválido.`)
      return false
    }
    if (transit != null && (!Number.isInteger(transit) || transit < 0)) {
      toastStore.error('Tránsito inválido', `${row.originName} → ${row.destinationName} debe tener días de tránsito enteros o quedar vacío.`)
      return false
    }
    if (row.validFromInput && row.validToInput && row.validFromInput > row.validToInput) {
      toastStore.error('Vigencia inválida', `${row.originName} → ${row.destinationName} tiene fechas de vigencia inválidas.`)
      return false
    }
  }
  return true
}

async function load() {
  loading.value = true
  try {
    const [data, currencyItems] = await Promise.all([
      FtlTariffService.browse(),
      CatalogItemsService.getByGroupSlug('currencies').catch(() => [] as CatalogItemDto[]),
    ])
    currencies.value = currencyItems.filter((item) => item.isActive)
    rows.value = data.map(toEditable)
    originalValues.value = new Map(rows.value.map((row) => [row.id, editableSnapshot(row)]))
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el tarifario maestro terrestre.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canUpdate.value || !dirtyRows.value.length || saving.value || !validateDirtyRows()) return

  const items: UpdateFtlTariffItem[] = dirtyRows.value.map((row) => ({
    id: row.id,
    priceAmount: parsedNumber(row.priceInput) as number,
    minimumAmount: parsedNumber(row.minimumInput, true),
    transitDays: parsedNumber(row.transitInput, true),
    warehouseName: row.warehouseInput.trim() || null,
    source: row.sourceInput.trim() || null,
    notes: row.notesInput.trim() || null,
    validFrom: row.validFromInput || null,
    validTo: row.validToInput || null,
    isActive: row.isActive,
  }))

  saving.value = true
  try {
    await FtlTariffService.updateBatch(items)
    toastStore.success('Tarifas terrestres actualizadas', `${items.length} tarifa${items.length === 1 ? '' : 's'} actualizada${items.length === 1 ? '' : 's'} correctamente.`)
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron guardar los cambios del tarifario terrestre.')
  } finally {
    saving.value = false
  }
}

function usdCurrency() {
  return currencies.value.find((item) => item.code?.trim().toUpperCase() === 'USD')
    ?? currencies.value.find((item) => item.value?.trim().toUpperCase() === 'USD')
    ?? currencies.value[0]
}

function currencyByCode(code?: string | null) {
  const normalized = String(code ?? '').trim().toUpperCase()
  if (!normalized) return usdCurrency()
  return currencies.value.find((item) => item.code?.trim().toUpperCase() === normalized)
    ?? currencies.value.find((item) => item.value?.trim().toUpperCase() === normalized)
    ?? usdCurrency()
}

function makeCreateItem(input: {
  shipmentMode?: string | null
  origin?: string | null
  originCode?: string | null
  destination?: string | null
  destinationCode?: string | null
  equipmentClass?: string | null
  equipmentLabel?: string | null
  price?: string | number | null
  minimum?: string | number | null
  transitDays?: string | number | null
  warehouse?: string | null
  source?: string | null
  notes?: string | null
  validFrom?: string | null
  validTo?: string | null
  isActive?: string | boolean | null
  currency?: string | null
}): CreateLandTariffItem | null {
  const shipmentMode: LandShipmentMode = String(input.shipmentMode ?? selectedMode.value).trim().toLowerCase() === 'ltl' ? 'Ltl' : 'Ftl'
  const currency = currencyByCode(input.currency)
  if (!currency) {
    toastStore.error('Moneda requerida', 'No existe una moneda activa para crear/importar tarifas terrestres.')
    return null
  }

  const originName = String(input.origin ?? '').trim()
  const destinationName = String(input.destination ?? '').trim()
  const priceAmount = Number(input.price ?? '')
  if (!originName || !destinationName || !Number.isFinite(priceAmount) || priceAmount < 0) return null

  const minimumRaw = String(input.minimum ?? '').trim()
  const transitRaw = String(input.transitDays ?? '').trim()
  const minimumAmount = minimumRaw ? Number(minimumRaw) : null
  const transitDays = transitRaw ? Number(transitRaw) : null
  if (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0)) return null
  if (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0)) return null

  const equipmentClass = String(
    input.equipmentClass
      ?? (shipmentMode === 'Ltl' ? 'LTL_CBM' : selectedEquipmentClass.value),
  ).trim().toUpperCase()

  return {
    originName,
    originCode: String(input.originCode ?? '').trim() || null,
    destinationName,
    destinationCode: String(input.destinationCode ?? '').trim() || null,
    shipmentMode,
    equipmentClass,
    equipmentLabel: String(
      input.equipmentLabel
        ?? (shipmentMode === 'Ltl'
          ? 'LTL · USD/CBM'
          : equipmentOptions.find((option) => option.value === equipmentClass)?.label ?? 'Equipo FTL'),
    ).trim(),
    currencyId: currency.id,
    currencyName: currency.value?.trim() || currency.name,
    currencyCode: currency.code?.trim() || currency.value?.trim() || 'USD',
    priceAmount,
    rateBasis: shipmentMode === 'Ltl' ? 'PerCbm' : 'PerTruck',
    minimumAmount,
    transitDays,
    warehouseName: String(input.warehouse ?? '').trim() || null,
    source: String(input.source ?? '').trim() || null,
    notes: String(input.notes ?? '').trim() || null,
    validFrom: String(input.validFrom ?? '').trim() || null,
    validTo: String(input.validTo ?? '').trim() || null,
    isActive: typeof input.isActive === 'boolean'
      ? input.isActive
      : !['false', '0', 'no', 'inactivo'].includes(String(input.isActive ?? 'true').trim().toLowerCase()),
  }
}

function resetNewRate() {
  Object.assign(newRate, {
    originName: '',
    originCode: '',
    destinationName: '',
    destinationCode: '',
    priceAmount: '',
    minimumAmount: '',
    transitDays: '',
    warehouseName: '',
    source: '',
    notes: '',
    validFrom: '',
    validTo: '',
  })
}

async function createRate() {
  if (!canUpdate.value || creating.value) return
  const item = makeCreateItem({
    shipmentMode: selectedMode.value,
    origin: newRate.originName,
    originCode: newRate.originCode,
    destination: newRate.destinationName,
    destinationCode: newRate.destinationCode,
    equipmentClass: selectedMode.value === 'Ltl' ? 'LTL_CBM' : selectedEquipmentClass.value,
    price: newRate.priceAmount,
    minimum: newRate.minimumAmount,
    transitDays: newRate.transitDays,
    warehouse: newRate.warehouseName,
    source: newRate.source,
    notes: newRate.notes,
    validFrom: newRate.validFrom,
    validTo: newRate.validTo,
  })
  if (!item) {
    toastStore.error('Datos incompletos', 'Revise origen, destino, precio, mínimo y tránsito.')
    return
  }

  creating.value = true
  try {
    await FtlTariffService.create(item)
    toastStore.success('Tarifa terrestre guardada', `${item.originName} → ${item.destinationName} quedó disponible para ${item.shipmentMode.toUpperCase()}.`)
    resetNewRate()
    showNewRate.value = false
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la tarifa terrestre.')
  } finally {
    creating.value = false
  }
}

function parseCsvRow(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const headerAliases: Record<string, string> = {
  modalidad: 'shipmentMode', shipmentmode: 'shipmentMode', modo: 'shipmentMode',
  origen: 'origin', origin: 'origin', pol: 'origin',
  codigoorigen: 'originCode', origincode: 'originCode',
  destino: 'destination', destination: 'destination', pod: 'destination', poe: 'destination',
  codigodestino: 'destinationCode', destinationcode: 'destinationCode',
  equipo: 'equipmentClass', equipmentclass: 'equipmentClass', tipodeequipo: 'equipmentClass',
  etiquetadeequipo: 'equipmentLabel', equipmentlabel: 'equipmentLabel',
  precio: 'price', price: 'price', tarifa: 'price', rate: 'price', usdcbm: 'price',
  minimo: 'minimum', minimum: 'minimum', minimousd: 'minimum',
  transitodias: 'transitDays', transitdays: 'transitDays', diastransito: 'transitDays',
  almacen: 'warehouse', warehouse: 'warehouse', almacendeingreso: 'warehouse',
  fuente: 'source', source: 'source',
  notas: 'notes', notes: 'notes', comentarios: 'notes',
  vigenciadesde: 'validFrom', validfrom: 'validFrom',
  vigenciahasta: 'validTo', validto: 'validTo',
  activo: 'isActive', isactive: 'isActive',
  moneda: 'currency', currency: 'currency',
}

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim())
  if (lines.length < 2) return [] as CreateLandTariffItem[]
  const rawHeaders = parseCsvRow(lines[0])
  const headers = rawHeaders.map((header) => headerAliases[normalizeHeader(header)] ?? normalizeHeader(header))

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line)
    const record: Record<string, string> = {}
    headers.forEach((header, index) => { record[header] = values[index] ?? '' })
    return makeCreateItem(record)
  }).filter((item): item is CreateLandTariffItem => Boolean(item))
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !canUpdate.value || importing.value) return

  importing.value = true
  try {
    const text = await file.text()
    let items: CreateLandTariffItem[] = []
    if (file.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(text) as unknown
      const raw = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)
          ? (parsed as { items: unknown[] }).items
          : []
      items = raw
        .map((value) => makeCreateItem(value as Record<string, string | number | boolean | null>))
        .filter((item): item is CreateLandTariffItem => Boolean(item))
    } else {
      items = parseCsv(text)
    }

    if (!items.length) {
      toastStore.warning('Sin tarifas válidas', 'El archivo no contiene filas válidas. Use la plantilla CSV de Dhole.')
      return
    }

    const result = await FtlTariffService.importBatch(items)
    toastStore.success('Tarifario terrestre importado', `${result.created} nuevas y ${result.updated} actualizadas de ${result.total} tarifas.`)
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo importar el tarifario terrestre.')
  } finally {
    importing.value = false
  }
}

function downloadTemplate() {
  const mode = selectedMode.value
  const equipment = mode === 'Ltl' ? 'LTL_CBM' : selectedEquipmentClass.value
  const label = mode === 'Ltl'
    ? 'LTL · USD/CBM'
    : equipmentOptions.find((option) => option.value === equipment)?.label ?? 'Equipo FTL'
  const example = mode === 'Ltl'
    ? ['Ltl', 'San José, Costa Rica', '', 'Managua, Nicaragua', '', equipment, label, '40', '55', '3', 'Almacén Fiscal Premier 6117', 'Proveedor / tarifario', 'Tránsito estimado', '', '', 'true', 'USD']
    : ['Ftl', 'Costa Rica', '', 'Nicaragua', '', equipment, label, '1400', '', '4', '', 'Proveedor / tarifario', '', '', '', 'true', 'USD']
  const headers = ['shipmentMode','origin','originCode','destination','destinationCode','equipmentClass','equipmentLabel','price','minimum','transitDays','warehouse','source','notes','validFrom','validTo','isActive','currency']
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
  const csv = [headers.join(','), example.map(escape).join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `dhole-tarifas-${mode.toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas terrestres FTL / LTL"
      subtitle="Administre, cree e importe los fletes terrestres que Dhole utiliza en cotizaciones directas y continuaciones multimodales vía Panamá."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :disabled="loading || saving || importing" @click="load" />
          <DhButton v-if="canUpdate" label="Plantilla CSV" :icon="Download" variant="secondary" @click="downloadTemplate" />
          <DhButton v-if="canUpdate" label="Importar CSV / JSON" :icon="Upload" variant="secondary" :loading="importing" @click="fileInput?.click()" />
          <DhButton v-if="canUpdate" label="Nueva tarifa" :icon="Plus" variant="secondary" @click="showNewRate = !showNewRate" />
          <DhButton
            v-if="canUpdate"
            :label="dirtyRows.length ? `Guardar ${dirtyRows.length} cambios` : 'Guardar cambios'"
            :icon="Save"
            :loading="saving"
            :disabled="!dirtyRows.length || loading"
            @click="save"
          />
          <input ref="fileInput" type="file" accept=".csv,text/csv,.json,application/json" class="hidden" @change="importFile" />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Tarifario maestro terrestre</p>
          <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">FTL completos y LTL consolidados</h2>
          <p class="mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]">
            FTL se cobra por unidad completa. LTL se calcula por CBM con mínimo por ruta. Ambos pueden administrarse manualmente o cargarse en lote.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="mode in [{ value: 'Ftl', label: 'FTL · Camión completo' }, { value: 'Ltl', label: 'LTL · Consolidado por CBM' }]"
            :key="mode.value"
            type="button"
            class="rounded-2xl border px-4 py-3 text-sm font-black transition"
            :class="selectedMode === mode.value
              ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)] hover:border-[rgb(var(--dh-primary-rgb)/0.4)]'"
            @click="selectedMode = mode.value as LandShipmentMode"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>

      <div v-if="selectedMode === 'Ftl'" class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="option in equipmentOptions"
          :key="option.value"
          type="button"
          class="rounded-xl border px-4 py-2 text-xs font-black transition"
          :class="selectedEquipmentClass === option.value
            ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
            : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)]'"
          @click="selectedEquipmentClass = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="showNewRate && canUpdate" class="mt-5 rounded-[24px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-black">Nueva tarifa {{ selectedMode.toUpperCase() }}</h3>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Si la misma ruta y clase ya existe, Dhole la actualiza en lugar de duplicarla.</p>
          </div>
          <button type="button" class="text-sm font-black text-[var(--dh-text-muted)]" @click="showNewRate = false">Cerrar</button>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="text-xs font-black">Origen
            <input v-model="newRate.originName" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" placeholder="Costa Rica / San José, Costa Rica" />
          </label>
          <label class="text-xs font-black">Código origen
            <input v-model="newRate.originCode" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" placeholder="Opcional" />
          </label>
          <label class="text-xs font-black">Destino
            <input v-model="newRate.destinationName" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" placeholder="Nicaragua / Managua, Nicaragua" />
          </label>
          <label class="text-xs font-black">Código destino
            <input v-model="newRate.destinationCode" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" placeholder="Opcional" />
          </label>
          <label class="text-xs font-black">{{ selectedMode === 'Ltl' ? 'USD / CBM' : 'Precio por unidad' }}
            <input v-model="newRate.priceAmount" type="number" min="0" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-right font-black" />
          </label>
          <label v-if="selectedMode === 'Ltl'" class="text-xs font-black">Mínimo USD
            <input v-model="newRate.minimumAmount" type="number" min="0" step="0.01" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-right font-black" />
          </label>
          <label class="text-xs font-black">Tránsito · días
            <input v-model="newRate.transitDays" type="number" min="0" step="1" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-right font-black" />
          </label>
          <label class="text-xs font-black">Almacén de ingreso
            <input v-model="newRate.warehouseName" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" />
          </label>
          <label class="text-xs font-black">Vigencia desde
            <input v-model="newRate.validFrom" type="date" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" />
          </label>
          <label class="text-xs font-black">Vigencia hasta
            <input v-model="newRate.validTo" type="date" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" />
          </label>
          <label class="text-xs font-black">Fuente
            <input v-model="newRate.source" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" placeholder="Proveedor / tarifario" />
          </label>
          <label class="text-xs font-black md:col-span-2 xl:col-span-2">Notas
            <input v-model="newRate.notes" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 font-semibold" />
          </label>
        </div>
        <div class="mt-4 flex justify-end">
          <DhButton :label="creating ? 'Guardando…' : 'Guardar tarifa'" :loading="creating" @click="createRate" />
        </div>
      </div>

      <div v-if="loading" class="mt-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-14 text-center font-bold text-[var(--dh-text-muted)]">
        Cargando tarifas terrestres…
      </div>

      <div v-else-if="!visibleRows.length" class="mt-5 rounded-[24px] border border-dashed border-[var(--dh-border)] px-5 py-14 text-center">
        <p class="font-black text-[var(--dh-text)]">No hay tarifas configuradas para esta selección.</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Puede crear una tarifa manual o importar el tarifario desde CSV/JSON.</p>
      </div>

      <template v-else-if="selectedMode === 'Ftl'">
        <div class="mt-5 overflow-x-auto rounded-[24px] border border-[var(--dh-border)]">
          <table class="min-w-[1280px] w-full border-collapse text-sm">
            <thead>
              <tr class="bg-black/[0.035] dark:bg-white/[0.045]">
                <th class="sticky left-0 z-20 min-w-[170px] border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Origen ↓ / Destino →</th>
                <th v-for="destination in locations" :key="destination" class="min-w-[160px] border-b border-r border-[var(--dh-border)] px-3 py-3 text-center font-black text-[var(--dh-text)] last:border-r-0">{{ destination }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="origin in locations" :key="origin">
                <th class="sticky left-0 z-10 border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-left font-black text-[var(--dh-text)]">{{ origin }}</th>
                <td v-for="destination in locations" :key="`${origin}:${destination}`" class="border-b border-r border-[var(--dh-border)] p-2 align-top last:border-r-0">
                  <template v-for="rate in [findRate(origin, destination)]" :key="rate?.id || `${origin}:${destination}:empty`">
                    <div v-if="rate" class="rounded-xl border p-2 transition" :class="isDirty(rate) ? 'border-amber-400/60 bg-amber-500/10' : 'border-transparent bg-black/[0.025] dark:bg-white/[0.035]'">
                      <label class="block text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Precio {{ rate.currencyCode }}</label>
                      <input v-model="rate.priceInput" type="number" min="0" step="0.01" :disabled="!canUpdate || saving" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-black" />
                      <label class="mt-2 block text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Tránsito · días</label>
                      <input v-model="rate.transitInput" type="number" min="0" step="1" placeholder="—" :disabled="!canUpdate || saving" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-bold" />
                      <label class="mt-2 flex items-center gap-2 text-[10px] font-black uppercase text-[var(--dh-text-muted)]">
                        <input v-model="rate.isActive" type="checkbox" :disabled="!canUpdate || saving" /> Activa
                      </label>
                    </div>
                    <div v-else class="flex min-h-[124px] items-center justify-center text-lg font-black text-[var(--dh-text-muted)]/40">—</div>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="mt-5 overflow-x-auto rounded-[24px] border border-[var(--dh-border)]">
        <table class="min-w-[1280px] w-full border-collapse text-sm">
          <thead class="bg-black/[0.035] dark:bg-white/[0.045]">
            <tr>
              <th class="px-3 py-3 text-left font-black">Ruta</th>
              <th class="px-3 py-3 text-right font-black">USD / CBM</th>
              <th class="px-3 py-3 text-right font-black">Mínimo</th>
              <th class="px-3 py-3 text-right font-black">Tránsito</th>
              <th class="px-3 py-3 text-left font-black">Almacén</th>
              <th class="px-3 py-3 text-left font-black">Fuente / vigencia</th>
              <th class="px-3 py-3 text-center font-black">Activa</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rate in visibleRows" :key="rate.id" class="border-t border-[var(--dh-border)]" :class="isDirty(rate) ? 'bg-amber-500/10' : ''">
              <td class="px-3 py-3">
                <strong>{{ rate.originName }} → {{ rate.destinationName }}</strong>
                <p v-if="rate.notesInput" class="mt-1 max-w-sm text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ rate.notesInput }}</p>
              </td>
              <td class="px-3 py-3"><input v-model="rate.priceInput" type="number" min="0" step="0.01" :disabled="!canUpdate || saving" class="w-28 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-black" /></td>
              <td class="px-3 py-3"><input v-model="rate.minimumInput" type="number" min="0" step="0.01" :disabled="!canUpdate || saving" class="w-24 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-black" /></td>
              <td class="px-3 py-3"><input v-model="rate.transitInput" type="number" min="0" step="1" :disabled="!canUpdate || saving" class="w-20 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-bold" /></td>
              <td class="px-3 py-3"><input v-model="rate.warehouseInput" :disabled="!canUpdate || saving" class="min-w-[210px] rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 font-semibold" /></td>
              <td class="px-3 py-3">
                <input v-model="rate.sourceInput" :disabled="!canUpdate || saving" class="min-w-[190px] rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 font-semibold" />
                <div class="mt-2 flex gap-1">
                  <input v-model="rate.validFromInput" type="date" :disabled="!canUpdate || saving" class="w-32 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1 text-[11px]" />
                  <input v-model="rate.validToInput" type="date" :disabled="!canUpdate || saving" class="w-32 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1 text-[11px]" />
                </div>
              </td>
              <td class="px-3 py-3 text-center"><input v-model="rate.isActive" type="checkbox" :disabled="!canUpdate || saving" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[var(--dh-text-muted)]">
        <span>{{ visibleRows.length }} rutas {{ selectedMode.toUpperCase() }} configuradas</span>
        <span v-if="dirtyRows.length" class="font-black text-amber-600 dark:text-amber-300">{{ dirtyRows.length }} cambios sin guardar</span>
      </div>
    </section>
  </section>
</template>
