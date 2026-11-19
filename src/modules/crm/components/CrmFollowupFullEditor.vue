<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { DhButton } from '@/shared/components/atoms'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'
import { crmError, crmPath, crmRequest, fromUtc, toUtc, type CrmRow } from '../services/crmApi'

interface AgendaUser { id: string; displayName?: string; userName?: string }
const props = defineProps<{
  followup: CrmRow
  canManage: boolean
  ownerName?: string
}>()
const emit = defineEmits<{ saved: [] }>()
const editing = ref(false)
const saving = ref(false)
const loadingUsers = ref(false)
const inviteesLoaded = ref(false)
const error = ref('')
const search = ref('')
const users = ref<AgendaUser[]>([])
const invitedIds = ref<string[]>([])
const form = reactive({
  subject: '', assignedUserId: '', channel: 'SYSTEM',
  startAt: '', dueAt: '', reminderLeadMinutes: '60',
  reminderChannelStrategy: 'BOTH',
})
const currentOwnerId = computed(() => String(props.followup.assignedUserId ?? ''))
const userOptions = computed(() => {
  const directory = new Map<string, AgendaUser>(
    users.value.filter(user => user.id).map(user => [user.id, user]))
  if (currentOwnerId.value && !directory.has(currentOwnerId.value))
    directory.set(currentOwnerId.value, { id: currentOwnerId.value,
      displayName: props.ownerName || 'Responsable actual' })
  for (const userId of invitedIds.value)
    if (!directory.has(userId))
      directory.set(userId, { id: userId, displayName: 'Usuario invitado actualmente' })
  return [...directory.values()].sort((a,b) =>
    (a.displayName || a.userName || a.id).localeCompare(
      b.displayName || b.userName || b.id, 'es'))
})
const draft = useCrmDraftAutosave({
  scope: () => 'followup-detail:' + props.followup.id,
  enabled: () => editing.value,
  capture: () => ({ fields: { ...form }, invitedIds: invitedIds.value }),
  apply: (snapshot) => {
    Object.assign(form, snapshot.fields)
    invitedIds.value = snapshot.invitedIds ?? []
  },
})
function reset() {
  form.subject = String(props.followup.subject ?? '')
  form.assignedUserId = currentOwnerId.value
  form.channel = String(props.followup.channel ?? 'SYSTEM')
  form.startAt = fromUtc(props.followup.startAt)
  form.dueAt = fromUtc(props.followup.dueAt)
  form.reminderLeadMinutes = String(props.followup.reminderLeadMinutes ?? 60)
  form.reminderChannelStrategy = String(props.followup.reminderChannelStrategy ?? 'BOTH')
}
async function searchUsers() {
  loadingUsers.value = true
  try {
    const response = await crmRequest<{ items: AgendaUser[] }>(
      crmPath('calendar/invitees') + '?page=1&pageSize=100&search=' +
      encodeURIComponent(search.value.trim()))
    const next = new Map(users.value.map(user => [user.id, user]))
    for (const user of response.items ?? []) if (user.id) next.set(user.id, user)
    users.value = [...next.values()]
  } catch (cause) {
    error.value = 'No se pudo cargar el directorio de usuarios: ' + crmError(cause)
  } finally {
    loadingUsers.value = false
  }
}
async function startEditing() {
  if (editing.value) {
    draft.stop()
    editing.value = false
    return
  }
  reset()
  error.value = ''
  invitedIds.value = []
  inviteesLoaded.value = false
  editing.value = true
  try {
    const invitees = await crmRequest<Array<{ userId: string }>>(
      crmPath('followups', String(props.followup.id), 'invitees'))
    invitedIds.value = invitees.map(x => String(x.userId)).filter(Boolean)
    inviteesLoaded.value = true
    await searchUsers()
    draft.begin()
  } catch (cause) {
    error.value = 'No se pudieron cargar los invitados. Reintentá antes de guardar: ' + crmError(cause)
  }
}
function toggleInvitee(userId: string, checked: boolean) {
  invitedIds.value = checked
    ? [...new Set([...invitedIds.value, userId])]
    : invitedIds.value.filter(id => id !== userId)
}
async function save() {
  if (!props.canManage || saving.value || !inviteesLoaded.value) return
  error.value = ''
  const due = new Date(form.dueAt).getTime()
  const start = form.startAt ? new Date(form.startAt).getTime() : null
  if (!form.subject.trim() || form.subject.trim().length > 250 ||
      !form.assignedUserId || !form.channel || !Number.isFinite(due) ||
      (start !== null && (!Number.isFinite(start) || start >= due))) {
    error.value = 'Completá el asunto, responsable, tipo de gestión y fechas válidas. El inicio debe ser anterior a la finalización.'
    return
  }
  if (due < Date.now() && String(props.followup.status) !== 'Completed' &&
      String(props.followup.status) !== 'Cancelled' &&
      form.dueAt !== fromUtc(props.followup.dueAt)) {
    error.value = 'La nueva fecha de vencimiento debe estar en el futuro.'
    return
  }
  const lead = Number(form.reminderLeadMinutes)
  if (!Number.isInteger(lead) || lead < 0 || lead > 10080) {
    error.value = 'El aviso anticipado debe estar entre 0 y 10080 minutos.'
    return
  }
  saving.value = true
  try {
    await crmRequest(crmPath('followups', String(props.followup.id), 'details'), 'PUT', {
      expectedVersion: Number(props.followup.rowVersion ?? 0),
      subject: form.subject.trim(),
      assignedUserId: form.assignedUserId,
      channel: form.channel,
      startAt: form.startAt ? toUtc(form.startAt) : null,
      dueAt: toUtc(form.dueAt),
      reminderLeadMinutes: lead,
      reminderChannelStrategy: form.reminderChannelStrategy,
      inviteeUserIds: [...new Set(invitedIds.value)].filter(id => id !== form.assignedUserId),
    })
    draft.commit()
    editing.value = false
    emit('saved')
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
watch(() => props.followup.rowVersion, () => {
  if (!editing.value) reset()
}, { immediate: true })
</script>

<template>
  <section v-if="canManage" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 sm:p-4"
    data-crm-followup-full-editor>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-extrabold">Editar seguimiento o recordatorio</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Cambiá el asunto, las fechas, el responsable, los invitados y los avisos sin crear otro registro.
          Las modificaciones quedan en el historial del CRM.
        </p>
      </div>
      <DhButton :label="editing ? 'Cerrar edición' : 'Editar seguimiento'" size="sm"
        variant="secondary" :disabled="saving" @click="startEditing" />
    </div>
    <form v-if="editing" class="mt-4 space-y-4" @submit.prevent="save">
      <p v-if="draft.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">
        {{ draft.status.value === 'restored' ? 'Se recuperó un borrador sin guardar.' :
          draft.status.value === 'saved' ? 'Borrador local guardado.' :
          'No se pudo conservar el borrador en este navegador.' }}
      </p>
      <p v-if="error" role="alert" class="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="sm:col-span-2 space-y-1 text-xs font-bold">Asunto
          <input v-model.trim="form.subject" class="crm-followup-input" maxlength="250" required />
        </label>
        <label class="space-y-1 text-xs font-bold">Tipo de gestión
          <select v-model="form.channel" class="crm-followup-input" required>
            <option value="SYSTEM">Sistema</option>
            <option value="EMAIL">Correo electrónico</option>
            <option value="PHONE">Llamada</option>
            <option value="VISIT">Visita</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Responsable
          <select v-model="form.assignedUserId" class="crm-followup-input" required>
            <option v-for="user in userOptions" :key="user.id" :value="user.id">
              {{ user.displayName || user.userName || user.id }}
            </option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Inicio programado (opcional)
          <input v-model="form.startAt" class="crm-followup-input" type="datetime-local" />
        </label>
        <label class="space-y-1 text-xs font-bold">Finalización / vencimiento
          <input v-model="form.dueAt" class="crm-followup-input" type="datetime-local" required />
        </label>
        <label class="space-y-1 text-xs font-bold">Avisar antes
          <select v-model="form.reminderLeadMinutes" class="crm-followup-input">
            <option v-for="minutes in [0,5,15,30,60,120,240,1440,10080]" :key="minutes"
              :value="String(minutes)">{{ minutes === 0 ? 'Al vencimiento' : minutes === 1440 ? '1 día' : minutes === 10080 ? '7 días' : minutes + ' minutos' }}</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-bold">Notificar por
          <select v-model="form.reminderChannelStrategy" class="crm-followup-input">
            <option value="BOTH">Correo y sistema</option>
            <option value="SYSTEM">Solo sistema</option>
            <option value="EMAIL">Solo correo</option>
          </select>
        </label>
      </div>
      <section class="space-y-2 border-t border-[var(--dh-border)] pt-4">
        <h4 class="text-sm font-bold">Usuarios invitados</h4>
        <div class="flex gap-2">
          <input v-model.trim="search" class="crm-followup-input min-w-0 flex-1"
            placeholder="Buscar usuarios del sistema" aria-label="Buscar usuarios" />
          <DhButton label="Buscar" size="sm" variant="secondary" :loading="loadingUsers"
            type="button" @click="searchUsers" />
        </div>
        <div class="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[var(--dh-border)] p-2">
          <label v-for="user in userOptions.filter(user => user.id !== form.assignedUserId)"
            :key="user.id" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
            <input type="checkbox" :checked="invitedIds.includes(user.id)"
              :disabled="!inviteesLoaded" @change="toggleInvitee(user.id, ($event.target as HTMLInputElement).checked)" />
            <span>{{ user.displayName || user.userName || user.id }}</span>
          </label>
          <p v-if="!userOptions.length" class="text-xs text-[var(--dh-text-muted)]">Sin usuarios disponibles.</p>
        </div>
      </section>
      <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-4">
        <DhButton label="Cancelar" variant="secondary" type="button" :disabled="saving"
          @click="draft.stop(); editing = false" />
        <DhButton type="submit" label="Guardar cambios" :loading="saving"
          :disabled="saving || !inviteesLoaded" />
      </div>
    </form>
  </section>
</template>

<style scoped>
.crm-followup-input {
  display: block; width: 100%; min-width: 0; margin-top: .35rem; padding: .65rem;
  border: 1px solid var(--dh-border); border-radius: .65rem;
  background: var(--dh-input); color: var(--dh-text);
}
</style>
