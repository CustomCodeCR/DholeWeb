<script setup lang="ts">
import { computed, ref } from 'vue'
import { Archive, AlertTriangle } from 'lucide-vue-next'
import { DhModal } from '@/shared/components/organisms'
import { DhButton } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmPath, crmRequest } from '../services/crmApi'

type Resource = 'accounts' | 'leads' | 'contacts' | 'activities' | 'followups'
const props = withDefaults(defineProps<{
  resource: Resource
  recordId: string
  rowVersion: number
  recordName?: string
  status?: string
  size?: 'sm' | 'md'
}>(), { recordName: '', status: '', size: 'sm' })
const emit = defineEmits<{ archived: [] }>()
const auth = useAuthStore()
const required: Record<Resource, string[]> = {
  accounts: ['crm.account.archive'],
  leads: ['crm.lead.archive'],
  contacts: ['crm.contact.archive'],
  activities: ['crm.activity.delete'],
  followups: ['crm.task.manage', 'crm.followup.manage'],
}
const canArchive = computed(() => required[props.resource].some(scope => auth.hasScope(scope)))
const kind: Record<Resource, string> = {
  accounts: 'cliente', leads: 'prospecto', contacts: 'contacto',
  activities: 'actividad', followups: 'seguimiento',
}
const show = ref(false)
const reason = ref('')
const confirmation = ref('')
const busy = ref(false)
const error = ref('')
async function archive() {
  if (busy.value || !canArchive.value || !reason.value.trim() || confirmation.value !== 'ELIMINAR') return
  busy.value = true
  error.value = ''
  try {
    await crmRequest(crmPath(props.resource, props.recordId, 'delete'), 'POST', {
      expectedVersion: props.rowVersion, reason: reason.value.trim(),
    })
    show.value = false
    reason.value = ''
    confirmation.value = ''
    emit('archived')
  } catch(cause) {
    error.value = crmError(cause)
  } finally {
    busy.value = false
  }
}
function open() { error.value = ''; reason.value = ''; confirmation.value=''; show.value = true }
</script>

<template>
  <span v-if="canArchive" class="inline-flex" @click.stop @keydown.stop>
    <DhButton :icon="Archive" label="Eliminar" variant="ghost" :size="size"
      @click="open" />
    <DhModal :open="show" :title="'Eliminar permanentemente ' + kind[resource]" size="md"
      @close="!busy && (show=false)">
      <div class="space-y-4 p-2">
        <div class="flex gap-3 rounded-xl border border-amber-500/30 p-3">
          <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div class="space-y-1">
            <p class="text-sm font-bold">Esta acción elimina el registro de forma permanente.</p>
            <p class="text-xs text-[var(--dh-text-muted)]">
              No se puede deshacer. Si existen créditos, actividades u otras referencias históricas,
              el servidor impedirá el borrado para proteger la información vinculada.
            </p>
          </div>
        </div>
        <p class="break-words text-sm font-semibold">{{ recordName || kind[resource] }}</p>
        <label class="block space-y-1.5 text-sm font-semibold">
          Motivo de la eliminación *
          <textarea v-model="reason" rows="3" maxlength="1000"
            placeholder="Indicá por qué querés eliminarlo permanentemente…"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm" />
        </label>
        <label class="block space-y-1.5 text-sm font-semibold">
          Escribí ELIMINAR para confirmar *
          <input v-model="confirmation" type="text" autocomplete="off"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm"
            placeholder="ELIMINAR" />
        </label>
        <p v-if="error" class="text-sm text-red-500" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <DhButton label="Volver" variant="secondary" :disabled="busy" @click="show=false" />
          <DhButton label="Eliminar permanentemente" variant="danger" :loading="busy"
            :disabled="!reason.trim() || confirmation !== 'ELIMINAR' || busy" @click="archive" />
        </div>
      </div>
    </DhModal>
  </span>
</template>
