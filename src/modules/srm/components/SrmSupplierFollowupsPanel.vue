<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { History, Plus, RefreshCw } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { SrmApi, type SrmSupplierFollowup, type SrmFollowupInput } from '../services/srmApi'

const props = defineProps<{ supplierId: string; language?: string }>()
const auth = useAuthStore()
const rows = ref<SrmSupplierFollowup[]>([])
const kind = ref<SrmFollowupInput['kind']>('note')
const title = ref('')
const details = ref('')
const nextActionAt = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
let loadToken = 0
const validId = computed(() => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(props.supplierId))
const canCreate = computed(() => auth.hasScope('srm.supplier.update') && validId.value)
const en = computed(() => props.language === 'en')
const typeOptions = [
  { value: 'note', es: 'Nota', en: 'Note' },
  { value: 'call', es: 'Llamada', en: 'Call' },
  { value: 'email', es: 'Correo', en: 'Email' },
  { value: 'meeting', es: 'Reunión', en: 'Meeting' },
  { value: 'visit', es: 'Visita', en: 'Visit' },
  { value: 'other', es: 'Otra gestión', en: 'Other' },
]
function labelFor(value: string) {
  const option = typeOptions.find(row => row.value === value)
  return (en.value ? option?.en : option?.es) ?? value
}
function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(en.value ? 'en-US' : 'es-CR')
}
async function refresh() {
  const token = ++loadToken
  rows.value = []
  error.value = ''
  notice.value = ''
  if (!validId.value) return
  loading.value = true
  try {
    const response = await SrmApi.listFollowups(props.supplierId)
    if (token === loadToken) rows.value = response
  } catch (cause) {
    if (token === loadToken) error.value = cause instanceof Error ? cause.message : 'Error al cargar la bitácora.'
  } finally {
    if (token === loadToken) loading.value = false
  }
}
async function save() {
  if (!canCreate.value || saving.value || !title.value.trim()) return
  const currentId = props.supplierId
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await SrmApi.createFollowup(currentId, {
      kind: kind.value, title: title.value.trim(), details: details.value.trim(),
      nextActionAt: nextActionAt.value ? new Date(nextActionAt.value).toISOString() : null,
    })
    title.value = ''
    details.value = ''
    nextActionAt.value = ''
    await refresh()
    notice.value = en.value ? 'Follow-up saved.' : 'Gestión registrada en la bitácora.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo registrar el seguimiento.'
  } finally { saving.value = false }
}
watch(() => props.supplierId, () => { void refresh() }, { immediate: true })
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" data-srm-followups>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="flex items-center gap-2 text-sm font-extrabold">
          <History class="h-4 w-4 text-[var(--dh-primary)]" />{{ en ? 'Supplier follow-up and log' : 'Seguimiento y bitácora del proveedor' }}
        </h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          {{ en ? 'Permanent record of contact, commitments and next actions.' : 'Historial de contactos, acuerdos y próximas gestiones, con fecha y responsable.' }}
        </p>
      </div>
      <button v-if="validId" type="button" :disabled="loading || saving"
        class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold" @click="refresh">
        <RefreshCw class="mr-1 inline h-3.5 w-3.5" />{{ en ? 'Refresh' : 'Actualizar' }}
      </button>
    </div>
    <p v-if="!validId" class="text-xs text-[var(--dh-text-muted)]">
      {{ en ? 'Save the supplier first to add follow-ups.' : 'Guardá primero el proveedor para registrar seguimientos.' }}
    </p>
    <p v-if="error" role="alert" class="text-xs text-red-400">{{ error }}</p>
    <p v-if="notice" role="status" class="text-xs text-emerald-500">{{ notice }}</p>
    <div v-if="canCreate" class="space-y-3 rounded-xl bg-[var(--dh-shell)] p-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-semibold">{{ en ? 'Contact type' : 'Tipo de gestión' }}
          <select v-model="kind" class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
            <option v-for="option in typeOptions" :key="option.value" :value="option.value">{{ en ? option.en : option.es }}</option>
          </select>
        </label>
        <label class="text-xs font-semibold">{{ en ? 'Next follow-up (optional)' : 'Próximo seguimiento (opcional)' }}
          <input v-model="nextActionAt" type="datetime-local"
            class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" />
        </label>
      </div>
      <label class="block text-xs font-semibold">{{ en ? 'Subject *' : 'Asunto *' }}
        <input v-model="title" maxlength="200" :placeholder="en ? 'Supplier contact / agreement' : 'Contacto o acuerdo con proveedor'"
          class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" />
      </label>
      <label class="block text-xs font-semibold">{{ en ? 'Notes' : 'Detalle de la gestión' }}
        <textarea v-model="details" maxlength="4000" rows="3"
          class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-3"></textarea>
      </label>
      <button type="button" :disabled="saving || !title.trim()"
        class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        @click="save"><Plus class="h-4 w-4" />{{ saving ? (en ? 'Saving...' : 'Guardando...') : (en ? 'Log follow-up' : 'Registrar seguimiento') }}</button>
    </div>
    <p v-if="loading" class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Loading history...' : 'Cargando bitácora...' }}</p>
    <ul v-else-if="rows.length" class="space-y-3">
      <li v-for="entry in rows" :key="entry.id" class="rounded-xl border border-[var(--dh-border)] p-3">
        <div class="flex flex-wrap justify-between gap-2 text-xs">
          <strong class="break-words">{{ entry.title }}</strong>
          <span class="text-[var(--dh-text-muted)]">{{ displayDate(entry.createdAtUtc) }}</span>
        </div>
        <p class="mt-1 text-[11px] font-medium text-[var(--dh-primary)]">{{ labelFor(entry.kind) }} · {{ entry.createdByName }}</p>
        <p v-if="entry.details" class="mt-2 whitespace-pre-wrap break-words text-xs">{{ entry.details }}</p>
        <p v-if="entry.nextActionAtUtc" class="mt-2 text-xs text-[var(--dh-text-muted)]">
          {{ en ? 'Next action:' : 'Próxima gestión:' }} {{ displayDate(entry.nextActionAtUtc) }}
        </p>
      </li>
    </ul>
    <p v-else-if="validId && !error" class="text-xs text-[var(--dh-text-muted)]">
      {{ en ? 'No follow-ups yet.' : 'Aún no hay gestiones registradas.' }}
    </p>
  </section>
</template>
