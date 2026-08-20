<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Boxes,
  CalendarDays,
  ListChecks,
  Pencil,
  Power,
  PowerOff,
  Save,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhSwitch } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type {
  CarrierFreeDayRuleDto,
  RateTermBlockDto,
  RateTermItemDto,
  RateType,
  ShipmentMode,
  UpsertRateTermBlockRequest,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingTermDragBoard, {
  type PricingTermBoardColumn,
} from '@/modules/pricing/components/PricingTermDragBoard.vue'

const authStore = useAuthStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const rows = ref<RateTermItemDto[]>([])
const blocks = ref<RateTermBlockDto[]>([])
const freeDayRules = ref<CarrierFreeDayRuleDto[]>([])
const loading = ref(false)
type SettingsSection = 'items' | 'blocks' | 'freeDays'
const activeSection = ref<SettingsSection>('items')
const sections = [
  { id: 'items', label: 'Ítems', icon: ListChecks },
  { id: 'blocks', label: 'Bloques automáticos', icon: Boxes },
  { id: 'freeDays', label: 'Días libres por naviera', icon: CalendarDays },
] as const
function setActiveSection(section: SettingsSection) {
  activeSection.value = section
}
const editorOpen = ref(false)
const search = ref('')
const blockSearch = ref('')
const form = reactive({ id: '', text: '', sortOrder: '0', isActive: true })
const freeDayForm = reactive({ id: '', carrierId: '', freeDays: '0', isActive: true })
const blockForm = reactive({
  id: '',
  name: '',
  rateType: '' as RateType | '',
  shipmentMode: '' as ShipmentMode | '',
  poeId: '',
  incotermId: '',
  sortOrder: '0',
  isActive: true,
})
const blockIncludes = ref<string[]>([])
const blockSubjectTo = ref<string[]>([])
const blockExcludes = ref<string[]>([])
const blockItemsDrawerOpen = ref(false)

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.delete))
const canSetActive = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.setActive))
const isEditing = computed(() => Boolean(form.id))
const activeItems = computed(() =>
  rows.value
    .filter((item) => item.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text)),
)
const blockTermColumns: PricingTermBoardColumn[] = [
  {
    key: 'Includes',
    label: 'Tarifa incluye',
    hint: 'Ítems que el bloque agregará a la sección Incluye.',
  },
  {
    key: 'SubjectTo',
    label: 'Sujeto a',
    hint: 'Condiciones que el bloque agregará como Sujeto a.',
  },
  {
    key: 'Excludes',
    label: 'Tarifa no incluye',
    hint: 'Conceptos que el bloque agregará como expresamente excluidos.',
  },
]
const blockBoardValue = computed<Record<string, string[]>>({
  get: () => ({
    Includes: [...blockIncludes.value],
    SubjectTo: [...blockSubjectTo.value],
    Excludes: [...blockExcludes.value],
  }),
  set: (value) => {
    const includes = [...new Set(value.Includes ?? [])]
    const includeSet = new Set(includes)
    const subjectTo = [...new Set(value.SubjectTo ?? [])].filter((id) => !includeSet.has(id))
    const subjectSet = new Set(subjectTo)
    const excludes = [...new Set(value.Excludes ?? [])].filter(
      (id) => !includeSet.has(id) && !subjectSet.has(id),
    )

    blockIncludes.value = includes
    blockSubjectTo.value = subjectTo
    blockExcludes.value = excludes
  },
})
const blockAssignedCount = computed(
  () => blockIncludes.value.length + blockSubjectTo.value.length + blockExcludes.value.length,
)

function updateBlockBoard(value: Record<string, string[]>) {
  // Se actualizan las tres categorías explícitamente. Evita depender de la asignación
  // implícita de v-model sobre un computed y garantiza que Excludes llegue al payload.
  blockBoardValue.value = {
    Includes: [...(value.Includes ?? [])],
    SubjectTo: [...(value.SubjectTo ?? [])],
    Excludes: [...(value.Excludes ?? [])],
  }
}
function blockItemText(id: string) {
  return rows.value.find((item) => item.id === id)?.text ?? 'Ítem'
}
function openBlockItemsDrawer() {
  blockItemsDrawerOpen.value = true
}
const rateTypeOptions = [
  { label: 'SPOT y TARIFARIO', value: '' },
  { label: 'SPOT', value: 'Spot' },
  { label: 'TARIFARIO', value: 'Tariff' },
]
const shipmentModeOptions = [
  { label: 'Todas las modalidades', value: '' },
  { label: 'FCL', value: 'Fcl' },
  { label: 'LCL', value: 'Lcl' },
  { label: 'FTL', value: 'Ftl' },
  { label: 'LTL', value: 'Ltl' },
]

const columns: DhTableColumn<RateTermItemDto>[] = [
  { key: 'sortOrder', label: 'Orden', width: '100px' },
  { key: 'text', label: 'Ítem compartido' },
  { key: 'isActive', label: 'Estado', align: 'center', width: '130px' },
  { key: 'actions', label: '', align: 'right', width: '180px' },
]

const visibleRows = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return rows.value
  return rows.value.filter((item) => item.text.toLocaleLowerCase().includes(term))
})

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

const visibleBlocks = computed(() => {
  const term = normalizeSearchText(blockSearch.value)
  if (!term) return blocks.value
  return blocks.value.filter((block) => normalizeSearchText(block.name).includes(term))
})

function clearForm() {
  Object.assign(form, { id: '', text: '', sortOrder: '0', isActive: true })
  editorOpen.value = false
}
function openCreate() {
  Object.assign(form, { id: '', text: '', sortOrder: '0', isActive: true })
  editorOpen.value = true
}
function edit(item: RateTermItemDto) {
  Object.assign(form, {
    id: item.id,
    text: item.text,
    sortOrder: String(item.sortOrder),
    isActive: item.isActive,
  })
  editorOpen.value = true
}
function clearFreeDayForm() {
  Object.assign(freeDayForm, { id: '', carrierId: '', freeDays: '0', isActive: true })
}
function editFreeDay(rule: CarrierFreeDayRuleDto) {
  Object.assign(freeDayForm, {
    id: rule.id,
    carrierId: rule.carrierId,
    freeDays: String(rule.freeDays),
    isActive: rule.isActive,
  })
}
function clearBlockForm() {
  Object.assign(blockForm, {
    id: '',
    name: '',
    rateType: '',
    shipmentMode: '',
    poeId: '',
    incotermId: '',
    sortOrder: '0',
    isActive: true,
  })
  blockIncludes.value = []
  blockSubjectTo.value = []
  blockExcludes.value = []
  blockItemsDrawerOpen.value = false
}
function editBlock(block: RateTermBlockDto) {
  Object.assign(blockForm, {
    id: block.id,
    name: block.name,
    rateType: block.rateType ?? '',
    shipmentMode: block.shipmentMode ?? '',
    poeId: block.poeId ?? '',
    incotermId: block.incotermId ?? '',
    sortOrder: String(block.sortOrder),
    isActive: block.isActive,
  })
  blockIncludes.value = block.items
    .filter((x) => x.category === 'Includes')
    .map((x) => x.rateTermItemId)
  blockSubjectTo.value = block.items
    .filter((x) => x.category === 'SubjectTo')
    .map((x) => x.rateTermItemId)
  blockExcludes.value = block.items
    .filter((x) => x.category === 'Excludes')
    .map((x) => x.rateTermItemId)
}

async function load() {
  try {
    loading.value = true
    await catalogs.loadAll()
    ;[rows.value, blocks.value, freeDayRules.value] = await Promise.all([
      PricingService.browseRateTermItems(),
      PricingService.browseRateTermBlocks(),
      PricingService.browseCarrierFreeDayRules(),
    ])
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la configuración de ítems tarifarios.')
  } finally {
    loading.value = false
  }
}

async function save() {
  const text = form.text.trim()
  if (!text)
    return toastStore.warning('Texto requerido', 'Indique el ítem que se utilizará en las tarifas.')
  const sortOrder = Math.max(0, Number(form.sortOrder || 0))
  try {
    if (form.id) {
      await PricingService.updateRateTermItem(form.id, { text, sortOrder, isActive: form.isActive })
      toastStore.success('Ítem actualizado')
    } else {
      await PricingService.createRateTermItem({ text, sortOrder })
      toastStore.success('Ítem creado')
    }
    clearForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el ítem de tarifa.')
  }
}

async function saveFreeDays() {
  const carrier = catalogs.findById(catalogs.carriers.value, freeDayForm.carrierId)
  const freeDays = Number(freeDayForm.freeDays)
  if (!carrier) return toastStore.warning('Naviera requerida', 'Seleccione la línea naviera.')
  if (!Number.isFinite(freeDays) || freeDays < 0)
    return toastStore.warning('Días inválidos', 'Indique cero o más días libres.')
  const payload = {
    carrierId: carrier.id,
    carrierName: carrier.name,
    carrierCode: carrier.code,
    freeDays: Math.trunc(freeDays),
    isActive: freeDayForm.isActive,
  }
  try {
    if (freeDayForm.id) await PricingService.updateCarrierFreeDayRule(freeDayForm.id, payload)
    else await PricingService.createCarrierFreeDayRule(payload)
    toastStore.success(freeDayForm.id ? 'Mapeo actualizado' : 'Mapeo creado')
    clearFreeDayForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el mapeo de días libres.')
  }
}

function selectedSnapshot(kind: 'poe' | 'incoterm', id: string) {
  const collection = kind === 'poe' ? catalogs.poePorts.value : catalogs.incoterms.value
  return catalogs.findById(collection, id)
}

async function saveBlock() {
  if (!blockForm.name.trim())
    return toastStore.warning('Nombre requerido', 'Indique el nombre del bloque.')
  const poe = blockForm.poeId ? selectedSnapshot('poe', blockForm.poeId) : null
  const incoterm = blockForm.incotermId ? selectedSnapshot('incoterm', blockForm.incotermId) : null
  // Tomamos un snapshot antes del await para que ninguna reacción de UI pueda alterar
  // las categorías mientras se envía el bloque.
  const includesSnapshot = [...blockIncludes.value]
  const subjectToSnapshot = [...blockSubjectTo.value]
  const excludesSnapshot = [...blockExcludes.value]
  const items: UpsertRateTermBlockRequest['items'] = []
  includesSnapshot.forEach((id, index) =>
    items.push({ rateTermItemId: id, category: 'Includes', sortOrder: index }),
  )
  subjectToSnapshot.forEach((id, index) =>
    items.push({ rateTermItemId: id, category: 'SubjectTo', sortOrder: index }),
  )
  excludesSnapshot.forEach((id, index) =>
    items.push({ rateTermItemId: id, category: 'Excludes', sortOrder: index }),
  )
  const payload: UpsertRateTermBlockRequest = {
    name: blockForm.name.trim(),
    rateType: blockForm.rateType || null,
    shipmentMode: blockForm.shipmentMode || null,
    poeId: poe?.id ?? null,
    poeName: poe?.name ?? null,
    poeCode: poe?.code ?? null,
    incotermId: incoterm?.id ?? null,
    incotermName: incoterm?.name ?? null,
    incotermCode: incoterm?.code ?? null,
    sortOrder: Math.max(0, Number(blockForm.sortOrder || 0)),
    isActive: blockForm.isActive,
    items,
  }
  try {
    const editingId = blockForm.id
    const savedId = editingId
      ? (await PricingService.updateRateTermBlock(editingId, payload), editingId)
      : await PricingService.createRateTermBlock(payload)

    await load()
    const persisted = blocks.value.find((block) => block.id === savedId)
    const persistedExcludes = new Set(
      persisted?.items.filter((item) => item.category === 'Excludes').map((item) => item.rateTermItemId) ?? [],
    )
    const missingExcludes = excludesSnapshot.filter((id) => !persistedExcludes.has(id))
    if (missingExcludes.length) {
      throw new Error('El backend no devolvió todos los ítems de Tarifa no incluye después de guardar.')
    }

    toastStore.success(editingId ? 'Bloque actualizado' : 'Bloque creado')
    clearBlockForm()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el bloque automático.')
  }
}

async function toggleActive(item: RateTermItemDto) {
  try {
    await PricingService.setRateTermItemActive(item.id, { isActive: !item.isActive })
    toastStore.success(item.isActive ? 'Ítem inactivado' : 'Ítem activado')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del ítem.')
  }
}
async function remove(item: RateTermItemDto) {
  if (!window.confirm(`¿Eliminar “${item.text}”?`)) return
  try {
    await PricingService.deleteRateTermItem(item.id)
    toastStore.success('Ítem eliminado')
    if (form.id === item.id) clearForm()
    await load()
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudo eliminar el ítem de tarifa. Si está en un bloque, quítelo primero del bloque.',
    )
  }
}
async function removeFreeDay(rule: CarrierFreeDayRuleDto) {
  if (!window.confirm(`¿Eliminar el mapeo de ${rule.carrierName}?`)) return
  try {
    await PricingService.deleteCarrierFreeDayRule(rule.id)
    clearFreeDayForm()
    await load()
    toastStore.success('Mapeo eliminado')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el mapeo.')
  }
}
async function removeBlock(block: RateTermBlockDto) {
  if (!window.confirm(`¿Eliminar el bloque “${block.name}”?`)) return
  try {
    await PricingService.deleteRateTermBlock(block.id)
    clearBlockForm()
    await load()
    toastStore.success('Bloque eliminado')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el bloque.')
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Reglas e ítems de tarifa"
      subtitle="Administre ítems, bloques automáticos por SPOT/TARIFARIO, modalidad, POE e Incoterm, y días libres por línea naviera."
      :icon="ListChecks"
    />

    <div
      class="flex flex-wrap gap-2 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-2"
    >
      <button
        v-for="tab in sections"
        :key="tab.id"
        type="button"
        class="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition"
        :class="
          activeSection === tab.id
            ? 'bg-[var(--dh-primary)] text-white'
            : 'text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10'
        "
        @click="setActiveSection(tab.id)"
      >
        <component :is="tab.icon" class="h-4 w-4" /> {{ tab.label }}
      </button>
    </div>

    <section v-if="activeSection === 'items'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        title="Catálogo de ítems"
        create-label="Nuevo ítem"
        :show-create="canCreate"
        @create="openCreate"
        @refresh="load"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ rows.length }} ítems registrados. Un ítem solo puede estar en una categoría por
            cotización o por bloque.
          </p></template
        >
      </DhCrudToolbar>
      <div
        v-if="editorOpen"
        class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-black text-[var(--dh-text)]">
              {{ isEditing ? 'Editar ítem' : 'Nuevo ítem' }}
            </h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              La categoría se asigna en el bloque o directamente en la cotización.
            </p>
          </div>
          <DhButton label="Cerrar" variant="ghost" size="sm" :icon="X" @click="clearForm" />
        </div>
        <div class="grid gap-4 lg:grid-cols-[1fr_140px_auto] lg:items-end">
          <DhInput
            v-model="form.text"
            label="Ítem"
            placeholder="Ej.: 14 días libres en destino"
            @keyup.enter="save"
          /><DhInput
            v-model="form.sortOrder"
            type="number"
            min="0"
            step="1"
            label="Orden"
          /><DhButton
            :label="isEditing ? 'Guardar cambios' : 'Agregar ítem'"
            :icon="Save"
            @click="save"
          />
        </div>
      </div>
      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="visibleRows"
          :loading="loading"
          empty-text="No hay ítems que coincidan con la búsqueda."
          @row-click="(row) => canUpdate && edit(row)"
        >
          <template #cell-sortOrder="{ value }"
            ><span class="font-black text-[var(--dh-text-muted)]">{{ value }}</span></template
          >
          <template #cell-text="{ value }"
            ><p class="font-bold text-[var(--dh-text)]">{{ value }}</p></template
          >
          <template #cell-isActive="{ value }"
            ><DhBadge
              :label="value ? 'Activo' : 'Inactivo'"
              :variant="value ? 'success' : 'neutral'"
          /></template>
          <template #cell-actions="{ row }"
            ><div class="flex justify-end gap-1">
              <button
                v-if="canUpdate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                @click.stop="edit(row)"
              >
                <Pencil class="h-4 w-4" /></button
              ><button
                v-if="canSetActive"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                @click.stop="toggleActive(row)"
              >
                <PowerOff v-if="row.isActive" class="h-4 w-4 text-amber-600" /><Power
                  v-else
                  class="h-4 w-4 text-emerald-600"
                /></button
              ><button
                v-if="canDelete"
                type="button"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                @click.stop="remove(row)"
              >
                <Trash2 class="h-4 w-4" />
              </button></div
          ></template>
        </DhDataTable>
      </div>
    </section>

    <section
      v-else-if="activeSection === 'blocks'"
      class="grid gap-5 xl:grid-cols-[minmax(360px,0.85fr)_1.4fr]"
    >
      <div class="dh-glass dh-liquid rounded-[32px] p-5">
        <h2 class="text-lg font-black text-[var(--dh-text)]">
          {{ blockForm.id ? 'Editar bloque' : 'Nuevo bloque automático' }}
        </h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Deje una condición vacía para usarla como comodín. Ej.: TARIFARIO + FCL + Caldera + FOB.
        </p>
        <div class="mt-5 grid gap-4">
          <DhInput
            v-model="blockForm.name"
            label="Nombre del bloque"
            placeholder="Ej.: Tarifario FCL Caldera FOB"
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <DhSelect
              v-model="blockForm.rateType"
              label="Tipo de tarifa"
              :options="rateTypeOptions"
            /><DhSelect
              v-model="blockForm.shipmentMode"
              label="Modalidad"
              :options="shipmentModeOptions"
            />
          </div>
          <DhInput v-model="blockForm.sortOrder" type="number" min="0" label="Orden" />
          <DhSelect
            v-model="blockForm.poeId"
            label="POE"
            placeholder="Cualquier POE"
            :options="[{ label: 'Cualquier POE', value: '' }, ...catalogs.poeOptions.value]"
          />
          <DhSelect
            v-model="blockForm.incotermId"
            label="Incoterm"
            placeholder="Cualquier Incoterm"
            :options="[
              { label: 'Cualquier Incoterm', value: '' },
              ...catalogs.incotermOptions.value,
            ]"
          />
          <div
            class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-sm font-black text-[var(--dh-text)]">Ítems del bloque</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ blockAssignedCount }} ítems asignados. Adminístrelos en un drawer
                  independiente.
                </p>
              </div>
              <DhButton
                label="Configurar ítems"
                variant="secondary"
                size="sm"
                :icon="SlidersHorizontal"
                @click="openBlockItemsDrawer"
              />
            </div>
            <div v-if="blockAssignedCount" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div class="rounded-2xl border border-[var(--dh-border)] p-3">
                <p
                  class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
                >
                  Tarifa incluye · {{ blockIncludes.length }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="id in blockIncludes.slice(0, 4)"
                    :key="id"
                    class="max-w-full truncate rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    {{ blockItemText(id) }}
                  </span>
                  <span
                    v-if="blockIncludes.length > 4"
                    class="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold text-[var(--dh-text-muted)] dark:bg-white/5"
                  >
                    +{{ blockIncludes.length - 4 }}
                  </span>
                  <span
                    v-if="!blockIncludes.length"
                    class="text-xs font-semibold text-[var(--dh-text-muted)]"
                  >
                    Sin ítems
                  </span>
                </div>
              </div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-3">
                <p
                  class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
                >
                  Sujeto a · {{ blockSubjectTo.length }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="id in blockSubjectTo.slice(0, 4)"
                    :key="id"
                    class="max-w-full truncate rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300"
                  >
                    {{ blockItemText(id) }}
                  </span>
                  <span
                    v-if="blockSubjectTo.length > 4"
                    class="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold text-[var(--dh-text-muted)] dark:bg-white/5"
                  >
                    +{{ blockSubjectTo.length - 4 }}
                  </span>
                  <span
                    v-if="!blockSubjectTo.length"
                    class="text-xs font-semibold text-[var(--dh-text-muted)]"
                  >
                    Sin ítems
                  </span>
                </div>
              </div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-3">
                <p
                  class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
                >
                  Tarifa no incluye · {{ blockExcludes.length }}
                </p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="id in blockExcludes.slice(0, 4)"
                    :key="id"
                    class="max-w-full truncate rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-700 dark:text-red-300"
                  >
                    {{ blockItemText(id) }}
                  </span>
                  <span
                    v-if="blockExcludes.length > 4"
                    class="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-bold text-[var(--dh-text-muted)] dark:bg-white/5"
                  >
                    +{{ blockExcludes.length - 4 }}
                  </span>
                  <span
                    v-if="!blockExcludes.length"
                    class="text-xs font-semibold text-[var(--dh-text-muted)]"
                  >
                    Sin ítems
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <DhButton
              v-if="canCreate || (blockForm.id && canUpdate)"
              :label="blockForm.id ? 'Guardar bloque' : 'Crear bloque'"
              :icon="Save"
              @click="saveBlock"
            /><DhButton
              v-if="blockForm.id"
              label="Cancelar"
              variant="ghost"
              @click="clearBlockForm"
            />
          </div>
        </div>
      </div>
      <div class="space-y-3">
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[240px] flex-1">
              <DhInput
                v-model="blockSearch"
                label="Buscar bloque por nombre"
                placeholder="Ej.: FCL FOB Caldera"
              />
            </div>
            <span
              class="mb-1 rounded-full border border-[var(--dh-border)] px-3 py-2 text-xs font-black text-[var(--dh-text-muted)]"
            >
              {{ blockSearch.trim() ? `${visibleBlocks.length}/${blocks.length}` : blocks.length }} bloques
            </span>
          </div>
        </div>
        <article
          v-for="block in visibleBlocks"
          :key="block.id"
          class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-black text-[var(--dh-text)]">{{ block.name }}</h3>
                <DhBadge
                  :label="block.isActive ? 'Activo' : 'Inactivo'"
                  :variant="block.isActive ? 'success' : 'neutral'"
                />
              </div>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{
                  block.rateType === 'Spot'
                    ? 'SPOT'
                    : block.rateType === 'Tariff'
                      ? 'TARIFARIO'
                      : 'SPOT/TARIFARIO'
                }}
                · {{ block.shipmentMode?.toUpperCase() || 'Todas' }} ·
                {{ block.poeName || 'Cualquier POE' }} ·
                {{ block.incotermName || 'Cualquier Incoterm' }}
              </p>
            </div>
            <div class="flex gap-1">
              <button
                v-if="canUpdate"
                class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                @click="editBlock(block)"
              >
                <Pencil class="h-4 w-4" /></button
              ><button
                v-if="canDelete"
                class="rounded-xl p-2 text-red-500 hover:bg-red-500/10"
                @click="removeBlock(block)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <div
              v-for="category in [
                { key: 'Includes', label: 'Incluye' },
                { key: 'SubjectTo', label: 'Sujeto a' },
                { key: 'Excludes', label: 'No incluye' },
              ]"
              :key="category.key"
              class="rounded-2xl bg-black/[0.025] p-3 dark:bg-white/[0.04]"
            >
              <p
                class="text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]"
              >
                {{ category.label }}
              </p>
              <ul class="mt-2 space-y-1 text-xs font-semibold text-[var(--dh-text)]">
                <li
                  v-for="item in block.items.filter((x) => x.category === category.key)"
                  :key="item.rateTermItemId"
                >
                  • {{ item.text }}
                </li>
                <li
                  v-if="!block.items.some((x) => x.category === category.key)"
                  class="text-[var(--dh-text-muted)]"
                >
                  Sin ítems
                </li>
              </ul>
            </div>
          </div>
        </article>
        <div
          v-if="!visibleBlocks.length && !loading"
          class="rounded-[26px] border border-dashed border-[var(--dh-border)] p-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
        >
          {{
            blockSearch.trim() && blocks.length
              ? 'No se encontraron bloques con ese nombre.'
              : 'Todavía no hay bloques automáticos.'
          }}
        </div>
      </div>
    </section>

    <section v-else class="grid gap-5 xl:grid-cols-[minmax(330px,0.75fr)_1.4fr]">
      <div class="dh-glass dh-liquid rounded-[32px] p-5">
        <h2 class="text-lg font-black text-[var(--dh-text)]">
          {{ freeDayForm.id ? 'Editar mapeo' : 'Mapear días libres' }}
        </h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Al seleccionar esta naviera en una cotización, los días libres se completan
          automáticamente y el operario no los digita.
        </p>
        <div class="mt-5 grid gap-4">
          <DhSelect
            v-model="freeDayForm.carrierId"
            label="Línea naviera"
            placeholder="Seleccione naviera"
            :options="catalogs.carrierOptions.value"
          /><DhInput
            v-model="freeDayForm.freeDays"
            type="number"
            min="0"
            step="1"
            label="Días libres"
          />
          <div class="flex gap-2">
            <DhButton
              v-if="canCreate || (freeDayForm.id && canUpdate)"
              :label="freeDayForm.id ? 'Guardar mapeo' : 'Crear mapeo'"
              :icon="Save"
              @click="saveFreeDays"
            /><DhButton
              v-if="freeDayForm.id"
              label="Cancelar"
              variant="ghost"
              @click="clearFreeDayForm"
            />
          </div>
        </div>
      </div>
      <div class="space-y-3">
        <article
          v-for="rule in freeDayRules"
          :key="rule.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
        >
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-[var(--dh-text)]">{{ rule.carrierName }}</h3>
              <DhBadge
                :label="rule.isActive ? 'Activo' : 'Inactivo'"
                :variant="rule.isActive ? 'success' : 'neutral'"
              />
            </div>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              {{ rule.carrierCode }} ·
              <strong class="text-[var(--dh-text)]">{{ rule.freeDays }} días libres</strong>
            </p>
          </div>
          <div class="flex gap-1">
            <button
              v-if="canUpdate"
              class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
              @click="editFreeDay(rule)"
            >
              <Pencil class="h-4 w-4" /></button
            ><button
              v-if="canDelete"
              class="rounded-xl p-2 text-red-500 hover:bg-red-500/10"
              @click="removeFreeDay(rule)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </article>
        <div
          v-if="!freeDayRules.length && !loading"
          class="rounded-[26px] border border-dashed border-[var(--dh-border)] p-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]"
        >
          No hay líneas navieras mapeadas.
        </div>
      </div>
    </section>

    <DhDrawer
      :open="blockItemsDrawerOpen"
      :title="
        blockForm.name.trim() ? `Ítems · ${blockForm.name.trim()}` : 'Ítems del bloque automático'
      "
      size="xl"
      @close="blockItemsDrawerOpen = false"
    >
      <div class="space-y-5">
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <h3 class="font-black text-[var(--dh-text)]">Configure los ítems del bloque</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Arrastre cada ítem desde Disponibles hacia Tarifa incluye, Sujeto a o Tarifa no incluye.
            Puede devolverlo a Disponibles para quitarlo del bloque.
          </p>
        </div>

        <PricingTermDragBoard
          :model-value="blockBoardValue"
          :items="rows"
          :columns="blockTermColumns"
          @update:model-value="updateBlockBoard"
          available-label="Disponibles"
          available-hint="Ítems activos que todavía no forman parte del bloque."
        />

        <div
          class="sticky bottom-0 flex justify-end border-t border-[var(--dh-border)] bg-[var(--dh-bg)]/90 pt-4 backdrop-blur"
        >
          <DhButton label="Listo" :icon="Save" @click="blockItemsDrawerOpen = false" />
        </div>
      </div>
    </DhDrawer>
  </section>
</template>
