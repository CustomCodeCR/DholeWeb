<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessageSquareText, Plus, UsersRound, RefreshCw } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea, DhMultiSelect } from '@/shared/components/atoms'
import { crmError, crmPath, crmRequest, crmUuid, type CrmRow } from '../services/crmApi'
import { crmAgreementDrafts, type CrmAgreementDraft } from '../model/crmAgreementParser'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'

const props = defineProps<{
  activityId: string
  accountId?: string | null
  canManage: boolean
}>()

const notes = ref<CrmRow[]>([])
const participants = ref<CrmRow[]>([])
const contacts = ref<CrmRow[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const note = ref('')
const noteCommitments = ref<CrmAgreementDraft[]>([])
const noteToConvert = ref<string | null>(null)
const savedNoteDrafts = ref<CrmAgreementDraft[]>([])
function openSavedNote(entry: CrmRow) {
  const id = String(entry.id)
  if (noteToConvert.value === id) {
    noteToConvert.value = null
    return
  }
  savedNoteDrafts.value = crmAgreementDrafts(String(entry.noteText ?? ''),
    entry.createdAt ? new Date(String(entry.createdAt)) : new Date())
  noteToConvert.value = id
}
async function scheduleSavedNote() {
  if (saving.value || !noteToConvert.value || !savedNoteDrafts.value.length) return
  if (savedNoteDrafts.value.some(x => !x.title.trim() || !x.dueLocal ||
      !Number.isFinite(new Date(x.dueLocal).getTime()) ||
      new Date(x.dueLocal).getTime() <= Date.now())) {
    error.value = 'Para convertir el acuerdo, confirmá una fecha futura válida.'
    return
  }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const commitments = savedNoteDrafts.value.map(x => ({
      subject: x.title.trim(), dueAt: new Date(x.dueLocal).toISOString()
    }))
    await crmRequest(
      crmPath('activities', props.activityId, 'notes/' + noteToConvert.value + '/commitments'),
      'POST', {commitments}, crmUuid())
    message.value = 'Compromiso(s) agregados al calendario del cliente y vendedor.'
    noteToConvert.value = null
    await load()
  } catch (cause) {
    error.value = crmError(cause)
  } finally {saving.value = false}
}
watch(note, (text) => {
  // Ordinary observations must remain saveable without a deadline.
  // Only explicitly dated sentences or named agreements become calendar drafts.
  const parsed=crmAgreementDrafts(text).filter(item =>
    Boolean(item.dueLocal) || /^\s*(acuerdos?|compromisos?)\b/i.test(item.source))
  noteCommitments.value=parsed.map(item => {
    const old=noteCommitments.value.find(x=>x.source===item.source)
    return old ? {...item,title:old.title,dueLocal:old.dueLocal,
      hasExplicitTime:old.hasExplicitTime} : item
  })
})
const noteHasDueErrors = computed(() => noteCommitments.value.some(item =>
  !item.title.trim() || !item.dueLocal ||
  !Number.isFinite(new Date(item.dueLocal).getTime()) ||
  new Date(item.dueLocal).getTime() <= Date.now()))
const showParticipantForm = ref(false)
const participantName = ref('')
const selectedContactIds = ref<string[]>([])
const role = ref('ATTENDEE')
const noteAutosave = useCrmDraftAutosave({
  scope: () => 'activity-note:' + props.activityId,
  capture: () => ({ text: note.value, commitments: noteCommitments.value }),
  apply: (snapshot) => {
    note.value = snapshot.text
    noteCommitments.value = snapshot.commitments ?? []
  },
})
const participantAutosave = useCrmDraftAutosave({
  scope: () => 'activity-participants:' + props.activityId,
  enabled: () => showParticipantForm.value,
  capture: () => ({ name: participantName.value, contacts: selectedContactIds.value, role: role.value }),
  apply: (snapshot) => {
    participantName.value = snapshot.name
    selectedContactIds.value = snapshot.contacts ?? []
    role.value = snapshot.role
  },
})
watch(showParticipantForm, opened => {
  if (opened) participantAutosave.begin()
  else participantAutosave.stop()
})
let generation = 0

const linkedContactIds = computed(() =>
  new Set(participants.value.map(x => String(x.contactId ?? '')).filter(Boolean)))
const contactChoices = computed(() => contacts.value.map(contact => ({
  value: String(contact.contactId ?? contact.id),
  label: String(contact.name ?? contact.fullName ?? contact.displayName ?? 'Contacto'),
})).filter(option => option.value && option.value !== 'undefined' &&
  !linkedContactIds.value.has(option.value)))
const labelForContact = (id: unknown) =>
  contacts.value.find(x => String(x.contactId ?? x.id) === String(id))?.name ?? 'Contacto de la cuenta'
const roleLabel = (value: unknown) =>
  ({ORGANIZER:'Organizador',RESPONSIBLE:'Responsable',ATTENDEE:'Asistente',GUEST:'Invitado'} as Record<string,string>)[String(value)] ?? String(value ?? 'Participante')
const participantLabel = (row: CrmRow) =>
  String(row.participantName ?? (row.contactId ? labelForContact(row.contactId) : null) ??
    (row.userId ? 'Usuario interno' : 'Participante'))
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(x => x.slice(0,1)).join('').toLocaleUpperCase('es')
const formattedDate = (value: unknown) => {
  const time = value ? new Date(String(value)) : null
  return time && Number.isFinite(time.getTime())
    ? new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(time)
    : ''
}

async function load() {
  if (!props.activityId) return
  const request = ++generation
  loading.value = true
  error.value = ''
  const calls = [
    crmRequest<CrmRow[]>(crmPath('activities',props.activityId,'notes')),
    crmRequest<CrmRow[]>(crmPath('activities',props.activityId,'participants')),
    props.accountId
      ? crmRequest<CrmRow[]>(crmPath('accounts',props.accountId,'contacts'))
      : Promise.resolve([] as CrmRow[]),
  ]
  const results = await Promise.allSettled(calls)
  if (request !== generation) return
  if (results[0]?.status === 'fulfilled') notes.value = results[0].value
  if (results[1]?.status === 'fulfilled') participants.value = results[1].value
  if (results[2]?.status === 'fulfilled') contacts.value = results[2].value.map(row => row.contact ? row.contact as CrmRow : row)
  if (results.some(x => x.status === 'rejected'))
    error.value = 'No se pudo consultar toda la información. Revisá tus permisos y actualizá.'
  loading.value = false
}

async function addParticipant() {
  if (saving.value || !props.canManage || !props.activityId) return
  error.value = ''
  message.value = ''
  const byContact = Boolean(props.accountId)
  const ids = [...new Set(selectedContactIds.value)]
    .filter(id => !linkedContactIds.value.has(id))
  if (byContact ? !ids.length : !participantName.value.trim()) {
    error.value = 'Seleccioná contactos de la cuenta o ingresá el nombre del participante.'
    return
  }
  if (byContact && ids.some(id => !contactChoices.value.some(x => x.value === id))) {
    error.value = 'Todos los contactos deben pertenecer a esta cuenta.'
    return
  }
  saving.value = true
  let added = 0
  try {
    for (const id of (byContact ? ids : [null])) {
      await crmRequest<CrmRow>(crmPath('activities', props.activityId, 'participants'), 'POST', {
        contactId: byContact ? id : null, userId: null,
        participantName: byContact ? null : participantName.value.trim(),
        role: role.value,
      }, crmUuid())
      added++
    }
    participantAutosave.commit()
    selectedContactIds.value = []
    participantName.value = ''
    role.value = 'ATTENDEE'
    showParticipantForm.value = false
    await load()
    message.value = added === 1 ? 'Participante agregado a la actividad.' :
      added + ' participantes agregados a la actividad.'
  } catch (cause) {
    if (added) await load()
    error.value = crmError(cause) + (added ? ' Se agregaron ' + added + ' participantes antes del error.' : '')
    selectedContactIds.value = selectedContactIds.value.filter(id => !linkedContactIds.value.has(id))
  } finally { saving.value = false }
}
async function addNote() {
  if (saving.value || !props.canManage || !note.value.trim()) return
  if (noteHasDueErrors.value) {
    error.value = 'Confirmá una fecha futura para cada acuerdo antes de guardar.'
    return
  }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const items=noteCommitments.value.map(item=>({
      subject:item.title.trim(),dueAt:new Date(item.dueLocal).toISOString(),
    }))
    const saved=await crmRequest<CrmRow & {createdCommitments?: CrmRow[]}>(
      crmPath('activities',props.activityId,'notes'),'POST',{
        noteText: note.value.trim(),agreementCommitments:items,
      },crmUuid())
    if (saved?.id) notes.value=[...notes.value,saved]
    noteAutosave.commit()
    note.value=''
    noteCommitments.value=[]
    noteAutosave.begin()
    message.value=items.length
      ? 'Observación guardada y '+items.length+' compromiso(s) agregado(s) al calendario del cliente y vendedor.'
      : 'Observación agregada.'
    await load()
  } catch(cause) {
    error.value = crmError(cause)
  } finally { saving.value = false }
}
watch(() => [props.activityId, props.accountId], () => {
  noteAutosave.stop(); participantAutosave.stop()
  note.value = ''; noteCommitments.value = []
  participantName.value = ''; selectedContactIds.value = []; role.value = 'ATTENDEE'
  noteAutosave.begin()
  void load()
}, { immediate: true })
</script>

<template>
  <section class="space-y-3" data-crm-activity-collaboration>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold">Personas y observaciones</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Registrá quién participará y conservá el historial de la gestión.</p>
      </div>
      <DhButton :icon="RefreshCw" label="Actualizar" variant="secondary" size="sm" :loading="loading" @click="load" />
    </div>
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="message" role="status" class="text-sm text-[var(--dh-primary)]">{{ message }}</p>
    <p v-if="noteAutosave.status.value !== 'idle' || participantAutosave.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">Borrador de observaciones o participantes guardado. Podés retomarlo después.</p>
    <div class="grid gap-4 lg:grid-cols-2">
      <article class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <UsersRound class="h-5 w-5 text-[var(--dh-primary)]" />
            <h3 class="font-bold">Participantes</h3>
            <span class="rounded-full bg-[var(--dh-shell)] px-2 py-0.5 text-xs">{{ participants.length }}</span>
          </div>
          <DhButton v-if="canManage" :icon="Plus" :label="showParticipantForm ? 'Cerrar' : 'Añadir'"
            size="sm" variant="secondary" @click="showParticipantForm=!showParticipantForm" />
        </div>
        <form v-if="showParticipantForm && canManage" class="mt-4 space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4"
          @submit.prevent="addParticipant">
          <DhMultiSelect v-if="accountId && contacts.length"
            v-model="selectedContactIds" label="Contactos de la cuenta"
            :options="contactChoices" placeholder="Seleccionar participantes"
            search-placeholder="Buscar contacto..."
            empty-text="Todos los contactos ya están vinculados." />
          <p v-else-if="accountId" class="text-xs text-amber-600">Agregá contactos a esta cuenta para seleccionarlos.</p>
          <DhInput v-else v-model="participantName" label="Nombre del participante" placeholder="Nombre y apellidos" />
          <DhSelect v-model="role" label="Participación"
            :options="[{value:'ORGANIZER',label:'Organizador'},{value:'RESPONSIBLE',label:'Responsable'},{value:'ATTENDEE',label:'Asistente'},{value:'GUEST',label:'Invitado'}]" />
          <div class="flex justify-end gap-2">
            <DhButton label="Cancelar" variant="secondary" size="sm" @click="showParticipantForm=false" />
            <DhButton :label="accountId ? 'Guardar participantes' : 'Guardar participante'" size="sm" type="submit" :loading="saving" />
          </div>
        </form>
        <p v-if="!participants.length && !loading" class="mt-5 rounded-xl border border-dashed border-[var(--dh-border)] px-4 py-7 text-center text-sm text-[var(--dh-text-muted)]">
          No hay participantes todavía. Usá «Añadir» para registrar al primero.
        </p>
        <ul v-else class="mt-3 space-y-2">
          <li v-for="person in participants" :key="person.id"
            class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] px-3 py-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--dh-primary)]/10 text-xs font-bold text-[var(--dh-primary)]">
              {{ initials(participantLabel(person)) }}
            </span>
            <span class="min-w-0 flex-1">
              <strong class="block truncate text-sm">{{ participantLabel(person) }}</strong>
              <span class="text-xs text-[var(--dh-text-muted)]">{{ roleLabel(person.role) }}</span>
            </span>
          </li>
        </ul>
      </article>
      <article class="min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="flex items-center gap-2">
          <MessageSquareText class="h-5 w-5 text-[var(--dh-primary)]" />
          <h3 class="font-bold">Observaciones</h3>
          <span class="rounded-full bg-[var(--dh-shell)] px-2 py-0.5 text-xs">{{ notes.length }}</span>
        </div>
        <form v-if="canManage" class="mt-4 space-y-3" @submit.prevent="addNote">
          <DhTextarea v-model="note" label="Nueva observación o acuerdos" placeholder="Ej. Acuerdos: entregar contenedor el 10 de noviembre" />
          <div v-if="noteCommitments.length" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
            <p class="text-sm font-bold">Registrar acuerdos como compromisos</p>
            <p class="text-xs text-[var(--dh-text-muted)]">
              Cada acuerdo se agregará al calendario del cliente y del vendedor. Revisá la fecha y hora:
              09:00 es una sugerencia cuando el cliente no indicó una hora.
            </p>
            <div v-for="(item,index) in noteCommitments" :key="index" class="space-y-2 rounded-lg border border-[var(--dh-border)] p-2">
              <label class="block text-xs font-semibold">Acuerdo {{ index+1 }}
                <input v-model.trim="item.title" maxlength="250" required
                  class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
              </label>
              <label class="block text-xs font-semibold">Fecha límite
                <input v-model="item.dueLocal" type="datetime-local" required
                  class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
              </label>
              <p v-if="!item.dueLocal" class="text-xs text-amber-600">No se detectó fecha. Elegí la fecha del compromiso.</p>
            </div>
          </div>
          <div class="flex justify-end">
            <DhButton :label="noteCommitments.length ? 'Guardar acuerdos en calendario' : 'Guardar observación'"
              type="submit" size="sm" :loading="saving"
              :disabled="!note.trim() || noteHasDueErrors" />
          </div>
        </form>
        <p v-if="!notes.length && !loading" class="mt-4 rounded-xl border border-dashed border-[var(--dh-border)] px-4 py-7 text-center text-sm text-[var(--dh-text-muted)]">No hay observaciones registradas.</p>
        <ol v-else class="mt-4 space-y-3">
          <li v-for="entry in notes" :key="entry.id" class="border-l-2 border-[var(--dh-primary)]/40 py-1 pl-3">
            <p class="whitespace-pre-wrap break-words text-sm">{{ entry.noteText ?? entry.text ?? 'Observación' }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ formattedDate(entry.createdAt) }}</p>
            <button v-if="canManage && !String(entry.noteText ?? '').startsWith('[Historial de edición]') && crmAgreementDrafts(String(entry.noteText ?? '')).some(x => x.dueLocal)"
              type="button" class="mt-2 text-xs font-semibold text-[var(--dh-primary)] underline"
              @click="openSavedNote(entry)">
              {{ noteToConvert===entry.id ? 'Cerrar conversión' : 'Registrar acuerdos anteriores en calendario' }}
            </button>
            <form v-if="noteToConvert===entry.id"
              class="mt-3 space-y-2 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3"
              @submit.prevent="scheduleSavedNote">
              <p class="text-xs text-[var(--dh-text-muted)]">Confirmá las fechas de los acuerdos anteriores para crear sus compromisos.</p>
              <div v-for="(item,index) in savedNoteDrafts" :key="index" class="space-y-2">
                <input v-model.trim="item.title" maxlength="250" required aria-label="Acuerdo anterior"
                  class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
                <input v-model="item.dueLocal" type="datetime-local" required aria-label="Fecha límite del acuerdo anterior"
                  class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 text-sm text-[var(--dh-text)]" />
              </div>
              <DhButton type="submit" label="Agregar al calendario" size="sm" :loading="saving" />
            </form>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>
