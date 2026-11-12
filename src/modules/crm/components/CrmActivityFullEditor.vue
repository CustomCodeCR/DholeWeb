<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { DhButton } from '@/shared/components/atoms'
import CrmVisitMapPicker from './CrmVisitMapPicker.vue'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'
import { crmError, crmPath, crmRequest, fromUtc, toUtc, type CrmRow } from '../services/crmApi'

interface NoteDraft { id?: string; expectedVersion?: number; noteText: string }
interface AgreementDraft {
  id?: string; expectedVersion?: number; subject: string
  dueLocal: string; completed: boolean; remove: boolean
}
const props = defineProps<{
  activity: CrmRow
  notes: CrmRow[]
  commitments: CrmRow[]
  canManage: boolean
}>()
const emit = defineEmits<{ saved: [] }>()
const editing = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({
  subject: '', type: 'OTHER', locationText: '',
  locationLatitude: null as number | null, locationLongitude: null as number | null,
  scheduledStartAt: '', scheduledEndAt: '',
  reminderLeadMinutes: '60', reminderChannelStrategy: 'BOTH',
  repeatEveryDays: '0', reminderRepeatMinutes: '0',
})
const noteDrafts = ref<NoteDraft[]>([])
const agreementDrafts = ref<AgreementDraft[]>([])
function captureActivityDraft() {
  return { fields: { ...form }, notes: noteDrafts.value, agreements: agreementDrafts.value }
}
const activityDraft = useCrmDraftAutosave({
  scope: () => 'activity-detail:' + props.activity.id,
  enabled: () => editing.value,
  capture: captureActivityDraft,
  apply: (snapshot: ReturnType<typeof captureActivityDraft>) => {
    Object.assign(form, snapshot.fields)
    noteDrafts.value = snapshot.notes ?? []
    agreementDrafts.value = snapshot.agreements ?? []
  },
})

function reset() {
  const activity = props.activity
  form.subject = String(activity.subject ?? '')
  form.type = String(activity.type ?? 'OTHER')
  form.locationText = String(activity.locationText ?? '')
  form.locationLatitude = activity.locationLatitude == null ? null : Number(activity.locationLatitude)
  form.locationLongitude = activity.locationLongitude == null ? null : Number(activity.locationLongitude)
  form.scheduledStartAt = fromUtc(activity.scheduledStartAt)
  form.scheduledEndAt = fromUtc(activity.scheduledEndAt)
  form.reminderLeadMinutes = String(activity.reminderLeadMinutes ?? 60)
  form.reminderChannelStrategy = String(activity.reminderChannelStrategy ?? 'BOTH')
  form.repeatEveryDays = String(activity.repeatEveryDays ?? 0)
  form.reminderRepeatMinutes = String(activity.reminderRepeatMinutes ?? 0)
  noteDrafts.value = props.notes
    .filter(note => !String(note.noteText ?? '').startsWith('[Historial de edición]'))
    .map(note => ({
      id: String(note.id), expectedVersion: Number(note.rowVersion ?? 0),
      noteText: String(note.noteText ?? ''),
    }))
  agreementDrafts.value = props.commitments.map(item => ({
    id: String(item.id),
    expectedVersion: Number(item.rowVersion ?? 0),
    subject: String(item.subject ?? ''),
    dueLocal: fromUtc(item.dueAt),
    completed: String(item.status ?? '') === 'Completed',
    remove: false,
  }))
}
function applyVisitLocation(value: { address: string; latitude: number | null; longitude: number | null }) {
  form.locationText = value.address
  form.locationLatitude = value.latitude
  form.locationLongitude = value.longitude
}
function toggleEditing() {
  if (editing.value) { activityDraft.stop(); editing.value = false }
  else startEditing()
}
function startEditing() {
  activityDraft.stop()
  reset()
  error.value = ''
  editing.value = true
  activityDraft.begin()
}
function addNote() { noteDrafts.value.push({ noteText: '' }) }
function addAgreement() {
  agreementDrafts.value.push({
    subject: '', dueLocal: '', completed: false, remove: false,
  })
}
function removeNewNote(index: number) { noteDrafts.value.splice(index, 1) }
function removeNewAgreement(index: number) { agreementDrafts.value.splice(index, 1) }

async function save() {
  if (!props.canManage || saving.value) return
  error.value = ''
  if (!form.subject.trim() || !form.type) {
    error.value = 'El título y el tipo de gestión son obligatorios.'
    return
  }
  if (noteDrafts.value.some(note => Boolean(note.id) && !note.noteText.trim())) {
    error.value = 'Las minutas y los acuerdos existentes no pueden quedar vacíos.'
    return
  }
  if (agreementDrafts.value.some(item => !item.remove &&
      (!item.subject.trim() || !item.dueLocal))) {
    error.value = 'Cada compromiso activo requiere un nombre y una fecha.'
    return
  }
  if (agreementDrafts.value.some(item => !item.id && !item.remove &&
      new Date(item.dueLocal).getTime() <= Date.now())) {
    error.value = 'Los compromisos nuevos deben tener una fecha futura.'
    return
  }
  if (form.scheduledStartAt && form.scheduledEndAt &&
      new Date(form.scheduledEndAt) < new Date(form.scheduledStartAt)) {
    error.value = 'La finalización no puede ser anterior al inicio.'
    return
  }
  saving.value = true
  try {
    await crmRequest(
      crmPath('activities', String(props.activity.id), 'details'), 'PUT', {
        expectedVersion: Number(props.activity.rowVersion ?? 0),
        subject: form.subject.trim(),
        type: form.type,
        locationText: form.locationText.trim() || null,
        locationLatitude: form.type === 'VISIT' ? form.locationLatitude : null,
        locationLongitude: form.type === 'VISIT' ? form.locationLongitude : null,
        updateVisitCoordinates: true,
        scheduledStartAt: toUtc(form.scheduledStartAt),
        scheduledEndAt: toUtc(form.scheduledEndAt),
        reminderLeadMinutes: Number(form.reminderLeadMinutes),
        reminderChannelStrategy: form.reminderChannelStrategy,
        repeatEveryDays: Number(form.repeatEveryDays),
        reminderRepeatMinutes: Number(form.reminderRepeatMinutes),
        notes: noteDrafts.value.filter(note => note.id || note.noteText.trim()).map(note => ({
          id: note.id ?? null,
          expectedVersion: note.expectedVersion ?? null,
          noteText: note.noteText.trim(),
        })),
        commitments: agreementDrafts.value
          .filter(item => item.id || !item.remove)
          .map(item => ({
            id: item.id ?? null,
            expectedVersion: item.expectedVersion ?? null,
            subject: item.subject.trim(),
            dueAt: toUtc(item.dueLocal),
            completed: item.completed,
            remove: item.remove,
          })),
      },
    )
    activityDraft.commit()
    editing.value = false
    emit('saved')
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
watch(() => props.activity.rowVersion, () => {
  if (!editing.value) reset()
}, { immediate: true })
</script>

<template>
  <section v-if="canManage" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 sm:p-4"
    data-crm-activity-full-editor>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-extrabold">Editar actividad, minuta y acuerdos</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Se pueden actualizar actividades completadas. Los cambios en acuerdos conservan su historial.
        </p>
      </div>
      <DhButton :label="editing ? 'Cerrar edición' : 'Editar actividad completa'"
        size="sm" variant="secondary" :disabled="saving"
        @click="toggleEditing" />
    </div>
    <form v-if="editing" class="mt-4 space-y-5" @submit.prevent="save">
      <p v-if="activityDraft.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">
        {{ activityDraft.status.value === 'restored' ? 'Cambios recuperados del borrador.' :
          activityDraft.status.value === 'saved' ? 'Borrador guardado automáticamente.' :
          'No se pudo conservar el borrador en este navegador.' }}
      </p>
      <p v-if="error" role="alert" class="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="sm:col-span-2 space-y-1 text-xs font-bold">Título de la actividad
          <input v-model.trim="form.subject" class="crm-editor-input" maxlength="250" required />
        </label>
        <label class="space-y-1 text-xs font-bold">Tipo de gestión
          <select v-model="form.type" class="crm-editor-input" required>
            <option value="CALL">Llamada</option><option value="VISIT">Visita</option>
            <option value="EMAIL">Correo</option><option value="MEETING">Reunión</option>
            <option value="OTHER">Otra actividad</option>
          </select>
        </label>
        <label v-if="form.type !== 'VISIT'" class="space-y-1 text-xs font-bold">Ubicación
          <input v-model.trim="form.locationText" class="crm-editor-input" maxlength="2000" />
        </label>
        <div v-if="form.type === 'VISIT'" class="sm:col-span-2">
          <CrmVisitMapPicker :model-value="{ address: form.locationText, latitude: form.locationLatitude, longitude: form.locationLongitude }"
            :account-id="String(activity.accountId ?? '')" :lead-id="String(activity.leadId ?? '')"
            @update:model-value="applyVisitLocation" />
        </div>
        <label class="space-y-1 text-xs font-bold">Inicio programado
          <input v-model="form.scheduledStartAt" type="datetime-local" class="crm-editor-input" />
        </label>
        <label class="space-y-1 text-xs font-bold">Finalización
          <input v-model="form.scheduledEndAt" type="datetime-local" class="crm-editor-input" />
        </label>
        <label class="space-y-1 text-xs font-bold">Avisar antes
          <select v-model="form.reminderLeadMinutes" class="crm-editor-input">
            <option v-for="minutes in [0,5,15,30,60,120,240,1440]" :key="minutes" :value="String(minutes)">{{ minutes }} minutos</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Notificar por
          <select v-model="form.reminderChannelStrategy" class="crm-editor-input">
            <option value="BOTH">Correo y sistema</option>
            <option value="SYSTEM">Sistema</option>
            <option value="EMAIL">Correo</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Repetir actividad
          <select v-model="form.repeatEveryDays" class="crm-editor-input">
            <option v-for="days in [0,1,7,14,30]" :key="days" :value="String(days)">
              {{ days ? 'Cada ' + days + ' día(s)' : 'No se repite' }}
            </option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Repetir recordatorios
          <select v-model="form.reminderRepeatMinutes" class="crm-editor-input">
            <option v-for="minutes in [0,5,15,30,60,240,1440]" :key="minutes" :value="String(minutes)">
              {{ minutes ? 'Cada ' + minutes + ' minuto(s)' : 'No se repiten' }}
            </option>
          </select>
        </label>
      </div>
      <div class="space-y-3 border-t border-[var(--dh-border)] pt-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-bold">Minuta y acuerdos alcanzados</h4>
          <DhButton label="Añadir texto" size="sm" variant="secondary" @click="addNote" />
        </div>
        <div v-for="(note,index) in noteDrafts" :key="note.id || 'new-' + index"
          class="rounded-lg border border-[var(--dh-border)] p-3">
          <label class="block space-y-1 text-xs font-bold">
            {{ note.noteText.startsWith('Minuta:') ? 'Minuta' :
              note.noteText.startsWith('Acuerdos:') ? 'Acuerdos alcanzados' : 'Observación o acuerdo ' + (index + 1) }}
            <textarea v-model="note.noteText" rows="5" maxlength="20000" class="crm-editor-input min-h-28 resize-y"
              placeholder="Escribí la minuta o los acuerdos alcanzados" />
          </label>
          <button v-if="!note.id" type="button" class="mt-2 text-xs font-semibold text-red-500"
            @click="removeNewNote(index)">Quitar texto nuevo</button>
        </div>
        <p v-if="!noteDrafts.length" class="text-xs text-[var(--dh-text-muted)]">
          Esta actividad todavía no tiene minuta. Podés añadirla aquí.
        </p>
      </div>
      <div class="space-y-3 border-t border-[var(--dh-border)] pt-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h4 class="text-sm font-bold">Pendientes de los acuerdos ({{ agreementDrafts.filter(x => !x.remove).length }})</h4>
          <DhButton label="Añadir pendiente" size="sm" variant="secondary" @click="addAgreement" />
        </div>
        <article v-for="(item,index) in agreementDrafts" :key="item.id || 'new-' + index"
          class="space-y-3 rounded-lg border border-[var(--dh-border)] p-3"
          :class="item.remove && 'opacity-60'">
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
            <label class="block space-y-1 text-xs font-bold">Acuerdo o compromiso
              <input v-model.trim="item.subject" :disabled="item.remove" class="crm-editor-input" maxlength="250" required />
            </label>
            <label class="block space-y-1 text-xs font-bold">Fecha límite
              <input v-model="item.dueLocal" :disabled="item.remove" type="datetime-local" class="crm-editor-input" required />
            </label>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-xs font-bold">
              <input v-model="item.completed" :disabled="item.remove" type="checkbox"
                class="h-4 w-4 accent-[var(--dh-primary)]" />
              {{ item.completed ? 'Completado' : 'Pendiente' }}
            </label>
            <button v-if="item.id" type="button"
              class="text-xs font-semibold text-[var(--dh-primary)] underline"
              @click="item.remove = !item.remove">
              {{ item.remove ? 'Restaurar pendiente' : 'Quitar de pendientes' }}
            </button>
            <button v-else type="button" class="text-xs font-semibold text-red-500"
              @click="removeNewAgreement(index)">Descartar pendiente nuevo</button>
          </div>
          <p v-if="item.remove" class="text-xs text-[var(--dh-text-muted)]">
            Se retirará del listado, pero quedará en el historial del CRM.
          </p>
        </article>
      </div>
      <div class="flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] pt-4">
        <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click="editing=false" />
        <DhButton label="Guardar actividad completa" type="submit" :loading="saving" :disabled="saving" />
      </div>
    </form>
  </section>
</template>

<style scoped>
.crm-editor-input {
  display: block; width: 100%; min-width: 0; margin-top: .35rem; padding: .65rem;
  border: 1px solid var(--dh-border); border-radius: .65rem;
  background: var(--dh-input); color: var(--dh-text);
  font-size: .875rem; font-weight: 500;
}
</style>
