<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { crmPath, crmRequest, type CrmRow } from '../services/crmApi'

type Destination = 'seller' | 'client'
type Preference = { deliveryTarget: Destination; contactId: string | null; rowVersion: number }
const props = defineProps<{
  accountId: string
  contacts: CrmRow[]
  sellerName: string
  authorized: boolean
}>()
const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'saved'): void
  (e: 'open-contacts'): void
}>()
const destination = ref<Destination>('seller')
const contactId = ref('')
const rowVersion = ref(0)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
let generation = 0

const emailContacts = computed(() => props.contacts.filter(contact => {
  const email = String(contact.email ?? '').trim()
  return Boolean(contact.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}))
const selectedContact = computed(() =>
  emailContacts.value.find(contact => String(contact.id) === contactId.value))
const canSave = computed(() => props.authorized && !loading.value && !saving.value &&
  (destination.value === 'seller' || Boolean(selectedContact.value)))
function endpoint() { return crmPath('accounts', props.accountId, 'quote-delivery') }

async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await crmRequest<Preference>(endpoint())
    if (current !== generation) return
    destination.value = result.deliveryTarget === 'client' ? 'client' : 'seller'
    contactId.value = result.contactId ?? ''
    rowVersion.value = result.rowVersion
  } catch (cause) {
    if (current === generation) error.value = cause instanceof Error ? cause.message
      : 'No se pudo leer la configuración de envío.'
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(() => props.accountId, () => { void load() }, { immediate: true })

async function save() {
  if (!canSave.value) return
  error.value = ''
  notice.value = ''
  saving.value = true
  try {
    const response = await crmRequest<Preference>(endpoint(), 'PUT', {
      expectedVersion: rowVersion.value,
      deliveryTarget: destination.value,
      contactId: destination.value === 'client' ? contactId.value : null,
    })
    rowVersion.value = response.rowVersion
    contactId.value = response.contactId ?? ''
    destination.value = response.deliveryTarget
    notice.value = 'Preferencia guardada. Se aplicará a las próximas cotizaciones de esta cuenta, después de seleccionar la alternativa que se enviará.'
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message
      : 'No se pudo guardar. Actualizá la cuenta y volvé a intentarlo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form id="crm-account-quote-delivery" class="rounded-xl border border-[var(--dh-primary)]/35 bg-[var(--dh-card)] p-4 shadow-sm space-y-4"
    aria-label="Configurar envío de próximas cotizaciones" @submit.prevent="save">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-extrabold text-[var(--dh-text)]">Destinatarios de futuras cotizaciones</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Esta regla se guarda en la cuenta y se aplica a todas las próximas QUO,
          después de elegir la alternativa definitiva. No envía ninguna cotización ahora.
        </p>
      </div>
      <button type="button" :disabled="saving" class="hub-outline-button hub-small"
        aria-label="Cerrar configuración de destinatarios" @click="emit('cancel')">Cerrar</button>
    </div>

    <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando preferencia de esta cuenta…</p>
    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="loading || saving || !authorized">
      <legend class="mb-2 text-xs font-bold">¿A quién deben enviarse las próximas cotizaciones?</legend>
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
          <strong class="block">Al contacto del cliente</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">Con copia al vendedor asignado</span>
        </span>
      </label>
    </fieldset>

    <div v-if="destination === 'client'" class="space-y-2">
      <label for="crm-future-quote-contact" class="block text-xs font-bold">Contacto que recibirá las futuras cotizaciones *</label>
      <select id="crm-future-quote-contact" v-model="contactId" :disabled="loading || saving || !authorized"
        class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm text-[var(--dh-text)]">
        <option value="">Seleccioná un contacto</option>
        <option v-for="contact in emailContacts" :key="String(contact.id)" :value="String(contact.id)">
          {{ contact.name || contact.displayName }} · {{ contact.email }}
        </option>
      </select>
      <p v-if="!emailContacts.length" class="text-xs text-amber-600">
        No hay contactos vinculados con correo válido.
        <button type="button" class="hub-text-link" @click="emit('open-contacts')">Ir a Contactos</button>
      </p>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        Para: {{ selectedContact?.email || 'Seleccioná un contacto' }} · CC: {{ sellerName }}
      </p>
    </div>

    <p v-if="!authorized" role="alert" class="text-xs text-amber-600">
      Se requiere permiso para modificar esta cuenta.
    </p>
    <p v-if="error" role="alert" class="text-xs font-semibold text-red-500">{{ error }}</p>
    <p v-if="notice" role="status" class="text-xs font-bold text-[var(--dh-primary)]">{{ notice }}</p>
    <div class="flex justify-end">
      <button type="submit" :disabled="!canSave"
        class="rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar preferencia de envío' }}
      </button>
    </div>
  </form>
</template>
