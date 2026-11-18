<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MapPinned, Pencil, Plus, Save, Trash2, X } from 'lucide-vue-next'
import { DhMultiSelect, DhSelect } from '@/shared/components/atoms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { SrmApi, type SrmSupplierRoute, type SrmSupplierRouteInput, type SrmTransportMode } from '../services/srmApi'

const props = defineProps<{
  supplierId: string
  language: string
  canManage: boolean
}>()

const en = computed(() => props.language === 'en')
type RouteLocation = CatalogItemSelectDto & { role: 'pol' | 'poe' | 'pod' }
const locations = ref<RouteLocation[]>([])
const routes = ref<SrmSupplierRoute[]>([])
const loading = ref(false)
const catalogLoading = ref(false)
const saving = ref(false)
const error = ref('')
const editingId = ref('')
const deletingId = ref('')
const showingForm = ref(false)
const mode = ref<SrmTransportMode>('maritime')
const originIds = ref<string[]>([])
const destinationIds = ref<string[]>([])
const modes: { value: SrmTransportMode; label: string }[] = [
  { value: 'maritime', label: 'Marítimo' },
  { value: 'air', label: 'Aéreo' },
  { value: 'land', label: 'Terrestre' },
]

function locationMode(location: RouteLocation): SrmTransportMode {
  try {
    const metadata = JSON.parse(location.metadataJson || '{}') as Record<string, unknown>
    const declared = String(metadata.transportMode || metadata.modality || '').toLowerCase()
    if (declared === 'maritime' || declared === 'air' || declared === 'land') return declared
    const terminal = String(metadata.terminalType || '').toUpperCase()
    if (terminal === 'APT') return 'air'
    if (terminal === 'SD') return 'land'
  } catch { /* Legacy catalog items can have malformed metadata. */ }
  return 'maritime'
}

const origins = computed(() => locations.value.filter(item =>
  item.role === 'pol' && locationMode(item) === mode.value && item.isActive !== false)
  .map(item => ({ value: item.id, label: item.label })))
const destinations = computed(() => locations.value.filter(item =>
  item.role !== 'pol' && locationMode(item) === mode.value && item.isActive !== false)
  .map(item => ({ value: item.id, label: item.label + ' · ' + item.role.toUpperCase() })))
const labels = computed(() => new Map(locations.value.map(item => [item.id, item.label])))
const modeLabel = (value: SrmTransportMode) => modes.find(item => item.value === value)?.label || value
const pointLabel = (id: string) => labels.value.get(id) || id
const valid = computed(() => originIds.value.length > 0 && destinationIds.value.length > 0 &&
  originIds.value.length <= 30 && destinationIds.value.length <= 30 &&
  originIds.value.length * destinationIds.value.length <= 400)

function setMode(value: string | number) {
  if (value !== 'maritime' && value !== 'air' && value !== 'land') return
  if (mode.value === value) return
  mode.value = value
  originIds.value = []
  destinationIds.value = []
}
function reset() {
  showingForm.value = false
  editingId.value = ''
  mode.value = 'maritime'
  originIds.value = []
  destinationIds.value = []
  error.value = ''
}
function startCreate() {
  reset()
  showingForm.value = true
}
function startEdit(route: SrmSupplierRoute) {
  showingForm.value = true
  editingId.value = route.id
  mode.value = route.transportMode
  originIds.value = [...route.originIds]
  destinationIds.value = [...route.destinationIds]
  error.value = ''
}
async function reload() {
  if (!props.supplierId) { routes.value = []; return }
  loading.value = true
  try {
    routes.value = await SrmApi.listSupplierRoutes(props.supplierId)
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible cargar las rutas.'
  } finally {
    loading.value = false
  }
}
async function loadCatalogs() {
  catalogLoading.value = true
  try {
    const groups = await Promise.all((['pol', 'poe', 'pod'] as const).map(async role =>
      (await CatalogItemsService.select({ catalogGroupSlug: role }))
        .map(item => ({ ...item, role }))))
    locations.value = groups.flat()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible cargar los puntos logísticos.'
  } finally {
    catalogLoading.value = false
  }
}
async function save() {
  if (!props.canManage || !props.supplierId || !valid.value || saving.value) return
  saving.value = true
  error.value = ''
  const payload: SrmSupplierRouteInput = {
    transportMode: mode.value,
    originIds: [...new Set(originIds.value)],
    destinationIds: [...new Set(destinationIds.value)],
  }
  try {
    if (editingId.value) await SrmApi.updateSupplierRoute(props.supplierId, editingId.value, payload)
    else await SrmApi.createSupplierRoute(props.supplierId, payload)
    reset()
    await reload()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la cobertura.'
  } finally { saving.value = false }
}
async function remove(route: SrmSupplierRoute) {
  if (!props.canManage || saving.value) return
  if (deletingId.value !== route.id) { deletingId.value = route.id; return }
  saving.value = true
  error.value = ''
  try {
    await SrmApi.deleteSupplierRoute(props.supplierId, route.id)
    deletingId.value = ''
    if (editingId.value === route.id) reset()
    await reload()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo eliminar la ruta.'
  } finally { saving.value = false }
}

watch(() => props.supplierId, () => { reset(); void reload() }, { immediate: true })
onMounted(() => { void loadCatalogs() })
</script>

<template>
  <section class="space-y-5" data-srm-supplier-routes>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-2 text-base font-extrabold"><MapPinned class="h-5 w-5 text-[var(--dh-primary)]" />
          {{ en ? 'Supplier route coverage' : 'Rutas del proveedor' }}</h3>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
          {{ en ? 'Register origins and destinations for each transportation mode. Every selected origin can connect to every selected destination.' :
            'Registrá los orígenes y destinos por tipo de transporte. Cada origen seleccionado se combina con todos los destinos seleccionados.' }}
        </p>
      </div>
      <button v-if="canManage && !showingForm" type="button"
        class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 text-sm font-bold text-white"
        @click="startCreate"><Plus class="h-4 w-4" />{{ en ? 'Add route' : 'Agregar ruta' }}</button>
    </div>

    <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{{ error }}</p>
    <div v-if="showingForm" class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex items-center justify-between">
        <h4 class="font-bold">{{ editingId ? (en ? 'Edit coverage' : 'Modificar cobertura') : (en ? 'New coverage' : 'Nueva cobertura') }}</h4>
        <button type="button" class="rounded-lg p-2 hover:bg-[var(--dh-input)]" :aria-label="en ? 'Cancel' : 'Cancelar'" @click="reset"><X class="h-4 w-4" /></button>
      </div>
      <DhSelect :model-value="mode" @update:model-value="setMode" :options="modes" :label="en ? 'Transport mode' : 'Tipo de transporte'"
        :disabled="saving" />
      <div class="grid gap-4 lg:grid-cols-2">
        <DhMultiSelect v-model="originIds" :options="origins" :disabled="saving || catalogLoading"
          :label="en ? 'FROM · POL (multiple)' : 'DESDE · POL (selección múltiple)'"
          :placeholder="en ? 'Select origins' : 'Seleccionar orígenes'" />
        <DhMultiSelect v-model="destinationIds" :options="destinations" :disabled="saving || catalogLoading"
          :label="en ? 'TO · POE / POD (multiple)' : 'HACIA · POE / POD (selección múltiple)'"
          :placeholder="en ? 'Select destinations' : 'Seleccionar destinos'" />
      </div>
      <p class="text-xs text-[var(--dh-text-muted)]">
        {{ originIds.length }} {{ en ? 'origins' : 'orígenes' }} × {{ destinationIds.length }}
        {{ en ? 'destinations' : 'destinos' }} = {{ originIds.length * destinationIds.length }}
        {{ en ? 'serviceable pairs' : 'combinaciones atendibles' }}.
      </p>
      <p v-if="!valid && (originIds.length || destinationIds.length)" class="text-xs text-amber-500">
        {{ en ? 'Select both sides (max 30 locations each, 400 combinations).' :
          'Seleccioná ambos extremos (máximo 30 puntos por extremo y 400 combinaciones).' }}
      </p>
      <button type="button" :disabled="!valid || saving || catalogLoading"
        class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 text-sm font-bold text-white disabled:opacity-50"
        @click="save"><Save class="h-4 w-4" />{{ saving ? 'Guardando…' : (en ? 'Save route' : 'Guardar ruta') }}</button>
    </div>

    <p v-if="loading || catalogLoading" class="text-sm text-[var(--dh-text-muted)]">{{ en ? 'Loading coverage…' : 'Cargando cobertura…' }}</p>
    <p v-else-if="!routes.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-sm text-[var(--dh-text-muted)]">
      {{ en ? 'No routes registered yet.' : 'Este proveedor todavía no tiene rutas registradas.' }}
    </p>
    <div v-else class="grid gap-3">
      <article v-for="route in routes" :key="route.id"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span class="rounded-full bg-[rgb(var(--dh-primary-rgb)/0.12)] px-3 py-1 text-xs font-extrabold text-[var(--dh-primary)]">
            {{ modeLabel(route.transportMode) }}
          </span>
          <div v-if="canManage" class="flex flex-wrap gap-2">
            <button type="button" :disabled="saving" class="inline-flex items-center gap-1 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
              @click="startEdit(route)"><Pencil class="h-3.5 w-3.5" />{{ en ? 'Edit' : 'Modificar' }}</button>
            <button type="button" :disabled="saving" class="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500"
              @click="remove(route)"><Trash2 class="h-3.5 w-3.5" />
              {{ deletingId === route.id ? (en ? 'Confirm delete' : 'Confirmar eliminación') : (en ? 'Delete' : 'Eliminar') }}
            </button>
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><p class="text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">{{ en ? 'FROM · POL' : 'DESDE · POL' }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5"><span v-for="point in route.originIds" :key="point"
              class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1.5 text-xs font-semibold">{{ pointLabel(point) }}</span></div>
          </div>
          <div><p class="text-xs font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">{{ en ? 'TO · POE / POD' : 'HACIA · POE / POD' }}</p>
            <div class="mt-2 flex flex-wrap gap-1.5"><span v-for="point in route.destinationIds" :key="point"
              class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1.5 text-xs font-semibold">{{ pointLabel(point) }}</span></div>
          </div>
        </div>
        <p class="mt-3 text-xs text-[var(--dh-text-muted)]">{{ route.originIds.length * route.destinationIds.length }}
          {{ en ? 'combinations' : 'combinaciones' }}</p>
      </article>
    </div>
  </section>
</template>
