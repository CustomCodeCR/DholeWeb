<script setup lang="ts">
import { ref, watch } from 'vue'
import { MapPin, Plus, Pencil, RefreshCw, X } from 'lucide-vue-next'
import { crmError, crmPath, crmRequest, type CrmRow } from '../services/crmApi'
import CrmVisitMapPicker from './CrmVisitMapPicker.vue'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'

type LocationModel = { address: string; latitude: number | null; longitude: number | null }
const props = withDefaults(defineProps<{
  leadId: string; countryId?: string; canManage: boolean; converted?: boolean
}>(), { countryId: '', converted: false })
const emit = defineEmits<{ changed: [] }>()
const locations = ref<CrmRow[]>([])
const busy = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const editingId = ref('')
const expectedVersion = ref(0)
const editorOpen = ref(false)
const addressType = ref('WORK')
const location = ref<LocationModel>({ address: '', latitude: null, longitude: null })
function captureLeadLocation() { return { addressType: addressType.value, location: location.value } }
const locationAutosave = useCrmDraftAutosave({
  scope: () => 'lead-location:' + props.leadId + ':' + (editingId.value || 'new'),
  enabled: () => editorOpen.value,
  capture: captureLeadLocation,
  apply: (snapshot: ReturnType<typeof captureLeadLocation>) => {
    addressType.value = snapshot.addressType
    location.value = { ...snapshot.location }
  },
})
let requestId = 0
const locationTypes = [
  { value: 'WORK', label: 'Oficina / trabajo' },
  { value: 'WAREHOUSE', label: 'Bodega' },
  { value: 'BILLING', label: 'Facturación' },
  { value: 'OTHER', label: 'Otra ubicación' },
]
function typeLabel(value: unknown) {
  return locationTypes.find(x => x.value === value)?.label || 'Otra ubicación'
}
async function loadLocations() {
  const request = ++requestId
  busy.value = true
  error.value = ''
  try {
    const response = await crmRequest<CrmRow[]>(crmPath('leads', props.leadId, 'addresses'))
    if (request === requestId) locations.value = Array.isArray(response) ? response : []
  } catch (cause) {
    if (request === requestId) {
      locations.value = []
      error.value = crmError(cause)
    }
  } finally {
    if (request === requestId) busy.value = false
  }
}
watch(() => props.leadId, () => {
  locations.value = []
  editorOpen.value = false
  void loadLocations()
}, { immediate: true })
function resetEditor() {
  locationAutosave.stop()
  editingId.value = ''
  expectedVersion.value = 0
  addressType.value = 'WORK'
  location.value = { address: '', latitude: null, longitude: null }
  editorOpen.value = false
}
function startCreation() {
  resetEditor()
  message.value = ''
  error.value = ''
  editorOpen.value = true
  locationAutosave.begin()
}
function startEditing(item: CrmRow) {
  locationAutosave.stop()
  editingId.value = String(item.id)
  expectedVersion.value = Number(item.rowVersion ?? 0)
  addressType.value = String(item.addressType ?? 'WORK')
  location.value = {
    address: String(item.addressText ?? ''),
    latitude: item.locationLatitude == null ? null : Number(item.locationLatitude),
    longitude: item.locationLongitude == null ? null : Number(item.locationLongitude),
  }
  error.value = ''
  message.value = ''
  editorOpen.value = true
  locationAutosave.begin()
}
async function save() {
  if (saving.value || !props.canManage || props.converted) return
  const address = location.value.address.trim()
  if (!address) {
    error.value = 'Indicá la dirección o seleccioná un punto en el mapa.'
    return
  }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const body = {
      addressType: addressType.value,
      addressText: address,
      locationLatitude: location.value.latitude,
      locationLongitude: location.value.longitude,
    }
    if (editingId.value) {
      await crmRequest(crmPath('lead-addresses', editingId.value), 'PATCH', {
        ...body, expectedVersion: expectedVersion.value,
      })
    } else {
      await crmRequest(crmPath('leads', props.leadId, 'addresses'), 'POST', {
        ...body, countryId: props.countryId || null,
      })
    }
    locationAutosave.commit()
    resetEditor()
    message.value = 'La ubicación quedó registrada en el prospecto.'
    await loadLocations()
    emit('changed')
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="space-y-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
    data-crm-lead-locations>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-extrabold">Ubicaciones del prospecto</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Registrá sus oficinas, bodegas o lugares de visita. Aparecerán como opciones en la agenda comercial.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="visit-location-action" :disabled="busy" @click="loadLocations">
          <RefreshCw class="h-4 w-4" /> Actualizar
        </button>
        <button v-if="canManage && !converted" type="button" class="visit-location-action" @click="startCreation">
          <Plus class="h-4 w-4" /> Nueva ubicación
        </button>
      </div>
    </div>
    <p v-if="error" role="alert" class="text-sm text-amber-600">{{ error }}</p>
    <p v-if="message" role="status" class="text-sm text-emerald-600">{{ message }}</p>
    <p v-if="busy" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando ubicaciones…</p>
    <p v-else-if="!locations.length && !error" class="rounded-lg border border-dashed border-[var(--dh-border)] p-4 text-sm text-[var(--dh-text-muted)]">
      Todavía no hay ubicaciones registradas para este prospecto.
    </p>
    <div v-if="locations.length" class="grid gap-3 sm:grid-cols-2">
      <article v-for="item in locations" :key="String(item.id)"
        class="flex flex-col justify-between gap-3 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
        <div class="flex items-start gap-2">
          <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <div class="min-w-0">
            <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ typeLabel(item.addressType) }}</p>
            <p class="mt-1 break-words text-sm font-semibold">{{ item.addressText }}</p>
          </div>
        </div>
        <button v-if="canManage && !converted" type="button" class="visit-location-action self-end"
          @click="startEditing(item)"><Pencil class="h-4 w-4" /> Editar</button>
      </article>
    </div>
    <form v-if="editorOpen && canManage && !converted"
      class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4"
      @submit.prevent="save">
      <div class="flex items-center justify-between gap-2">
        <h4 class="text-sm font-extrabold">{{ editingId ? 'Editar ubicación' : 'Nueva ubicación' }}</h4>
        <button type="button" aria-label="Cerrar edición" @click="resetEditor"><X class="h-4 w-4" /></button>
      </div>
      <label class="block text-xs font-bold text-[var(--dh-text-muted)]">Tipo de ubicación
        <select v-model="addressType" class="visit-location-select mt-2">
          <option v-for="item in locationTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </label>
      <CrmVisitMapPicker v-model="location" />
      <div class="flex justify-end gap-2">
        <button type="button" class="visit-location-action" @click="resetEditor">Cancelar</button>
        <button type="submit" class="visit-location-action" :disabled="saving || !location.address.trim()">
          {{ saving ? 'Guardando…' : 'Guardar ubicación' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.visit-location-action { display:inline-flex;align-items:center;gap:.4rem;border:1px solid var(--dh-border);border-radius:.7rem;min-height:38px;padding:.55rem .7rem;font-size:.78rem;font-weight:700; }
.visit-location-action:hover:not(:disabled) { border-color:var(--dh-primary);color:var(--dh-primary); }
.visit-location-action:disabled { opacity:.55; }
.visit-location-select { display:block;width:100%;padding:.65rem;border:1px solid var(--dh-border);border-radius:.7rem;background:var(--dh-input);color:var(--dh-text); }
</style>
