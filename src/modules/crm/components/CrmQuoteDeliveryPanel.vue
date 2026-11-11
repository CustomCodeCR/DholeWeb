<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { crmPath, crmRequest, type CrmRow } from '../services/crmApi'

type DeliveryTarget = 'seller' | 'client'
interface DeliveryPreference {
  deliveryTarget: DeliveryTarget
  contactId: string | null
  rowVersion: number
  updatedAtUtc: string | null
}
const props = defineProps<{
  accountId: string
  contacts: CrmRow[]
  sellerName: string
  authorized: boolean
}>()
const emit = defineEmits<{
  (e: 'saved'): void
  (e: 'cancel'): void
  (e: 'open-contacts'): void
}>()

const destination = ref<DeliveryTarget>('seller')
const selectedContactId = ref('')
const rowVersion = ref(0)
const updatedAtUtc = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const error = ref('')
const notice = ref('')
let generation = 0
const emailContacts = computed(() => props.contacts.filter(contact => {
  const email = String(contact.email ?? '').trim()
  return Boolean(contact.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}))
const selectedContact = computed(() => emailContacts.value.find(
  contact => String(contact.id) === selectedContactId.value))
const canSave = computed(() => loaded.value && props.authorized &&
  !loading.value && !saving.value &&
  (destination.value === 'seller' || Boolean(selectedContact.value)))

async function loadPreference() {
  const current = ++generation
  loaded.value = false
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const preference = await crmRequest<DeliveryPreference>(
      crmPath('accounts', props.accountId, 'quote-delivery-preference'))
    if (current !== generation) return
    destination.value = preference.deliveryTarget === 'client' ? 'client' : 'seller'
    selectedContactId.value = preference.contactId || ''
    rowVersion.value = preference.rowVersion
    updatedAtUtc.value = preference.updatedAtUtc
    loaded.value = true
  } catch (cause) {
    if (current === generation)
      error.value = cause instanceof Error ? cause.message :
        'No se pudo cargar la configuración de envíos de esta cuenta.'
  } finally {
    if (current === generation) loading.value = false
  }
}

watch(() => props.accountId, () => { void loadPreference() }, { immediate: true })

async function savePreference() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const saved = await crmRequest<DeliveryPreference>(
      crmPath('accounts', props.accountId, 'quote-delivery-preference'),
      'PUT',
      {
        deliveryTarget: destination.value,
        contactId: destination.value === 'client' ? selectedContactId.value : null,
        expectedVersion: rowVersion.value,
      })
    destination.value = saved.deliveryTarget
    selectedContactId.value = saved.contactId || ''
    rowVersion.value = saved.rowVersion
    updatedAtUtc.value = saved.updatedAtUtc
    notice.value = 'Preferencia guardada. Se aplicará a todas las cotizaciones futuras de esta cuenta.'
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message :
      'No se pudo guardar la preferencia. No se modificaron los destinatarios.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form id="crm-account-quote-delivery"
    class="rounded-xl border border-[var(--dh-primary)]/35 bg-[var(--dh-card)] p-4 shadow-sm space-y-4"
    aria-label="Configurar envío de todas las cotizaciones futuras" @submit.prevent="savePreference">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-extrabold text-[var(--dh-text)]">Configurar envío de cotizaciones</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          La alternativa guardada se utilizará automáticamente en todas las próximas cotizaciones
          vinculadas a esta cuenta. No envía ninguna cotización ahora.
        </p>
      </div>
      <button type="button" :disabled="saving" class="hub-outline-button hub-small"
        @click="emit('cancel')">Cerrar</button>
    </div>

    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">
      Cargando preferencia actual…
    </p>
    <p v-if="!authorized" role="alert" class="text-xs text-amber-600">
      Necesitás permiso para actualizar esta cuenta.
    </p>
    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="loading || saving || !authorized">
      <legend class="mb-2 text-xs font-bold">Destinatario de todas las cotizaciones futuras</legend>
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--dh-border)] p-3">
        <input v-model="destination" type="radio" value="seller" class="mt-1 accent-[var(--dh-primary)]" />
        <span class="text-sm">
          <strong class="block">Solo al vendedor</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ sellerName }}</span>
        </span>
      </label>
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--dh-border)] p-3">
        <input v-model="destination" type="radio" value="client" class="mt-1 accent-[var(--dh-primary)]" />
        <span class="text-sm">
          <strong class="block">Enviar al cliente</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">Con copia al vendedor asignado</span>
        </span>
      </label>
    </fieldset>

    <div v-if="destination === 'client'" class="space-y-2">
      <label for="crm-quote-delivery-contact" class="block text-xs font-bold">
        Contacto que recibirá las próximas cotizaciones *
      </label>
      <select id="crm-quote-delivery-contact" v-model="selectedContactId"
        :disabled="loading || saving || !authorized"
        class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm text-[var(--dh-text)]">
        <option value="">Seleccioná un contacto</option>
        <option v-for="contact in emailContacts" :key="String(contact.id)"
          :value="String(contact.id)">
          {{ contact.name || contact.displayName }} · {{ contact.email }}
        </option>
      </select>
      <p v-if="!emailContacts.length" class="text-xs text-amber-600">
        Esta cuenta no tiene contactos con correo válido.
        <button type="button" class="hub-text-link" @click="emit('open-contacts')">
          Agregar contacto
        </button>
      </p>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        Para: {{ selectedContact?.email || 'Seleccioná un contacto' }} · CC: {{ sellerName }}
      </p>
    </div>

    <p v-if="updatedAtUtc" class="text-xs text-[var(--dh-text-muted)]">
      Última actualización: {{ new Date(updatedAtUtc).toLocaleString('es-CR') }}
    </p>
    <p v-if="notice" role="status" class="text-xs font-semibold text-emerald-500">{{ notice }}</p>
    <p v-if="error" role="alert" class="text-xs font-semibold text-red-500">{{ error }}</p>
    <div class="flex justify-end">
      <button type="submit" :disabled="!canSave"
        class="rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar para todas las próximas cotizaciones' }}
      </button>
    </div>
  </form>
</template>
