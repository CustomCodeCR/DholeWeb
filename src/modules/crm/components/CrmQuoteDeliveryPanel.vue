<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DhMultiSelect from '@/shared/components/atoms/DhMultiSelect.vue'
import { crmPath, crmRequest, type CrmRow } from '../services/crmApi'
import { useCrmDraftAutosave } from '../utils/crmDraftAutosave'

type DeliveryTarget = 'seller' | 'client'
interface DeliveryPreference {
  deliveryTarget: DeliveryTarget
  contactIds?: string[]
  contactId?: string | null // Older CRM responses remain readable.
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
const selectedContactIds = ref<string[]>([])
const rowVersion = ref(0)
const updatedAtUtc = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const error = ref('')
const notice = ref('')
let generation = 0
const deliveryAutosave = useCrmDraftAutosave({
  scope: () => 'account-quote-delivery:' + props.accountId,
  enabled: () => loaded.value && props.authorized,
  capture: () => ({ destination: destination.value, contacts: selectedContactIds.value }),
  apply: (snapshot) => {
    destination.value = snapshot.destination
    selectedContactIds.value = snapshot.contacts ?? []
  },
})

const emailContacts = computed(() => props.contacts.filter(contact => {
  const email = String(contact.email ?? '').trim()
  return Boolean(contact.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && String(contact.status ?? 'Active').toLowerCase() === 'active'
}))
const contactOptions = computed(() => emailContacts.value.map(contact => ({
  value: String(contact.id),
  label: String(contact.name || contact.displayName || contact.email),
  description: String(contact.email),
})))
const selectedContacts = computed(() => emailContacts.value.filter(contact =>
  selectedContactIds.value.includes(String(contact.id))))
const selectionValid = computed(() => selectedContactIds.value.length > 0 &&
  selectedContactIds.value.length === selectedContacts.value.length)
const canSave = computed(() => loaded.value && props.authorized &&
  !loading.value && !saving.value &&
  (destination.value === 'seller' || selectionValid.value))

async function loadPreference() {
  deliveryAutosave.stop()
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
    selectedContactIds.value = Array.isArray(preference.contactIds)
      ? [...new Set(preference.contactIds)]
      : preference.contactId ? [preference.contactId] : []
    rowVersion.value = preference.rowVersion
    updatedAtUtc.value = preference.updatedAtUtc
    loaded.value = true
    deliveryAutosave.begin()
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
      crmPath('accounts', props.accountId, 'quote-delivery-preference'), 'PUT', {
        deliveryTarget: destination.value,
        contactIds: destination.value === 'client' ? selectedContactIds.value : [],
        expectedVersion: rowVersion.value,
      })
    destination.value = saved.deliveryTarget
    selectedContactIds.value = Array.isArray(saved.contactIds) ? saved.contactIds
      : saved.contactId ? [saved.contactId] : []
    rowVersion.value = saved.rowVersion
    updatedAtUtc.value = saved.updatedAtUtc
    deliveryAutosave.commit()
    deliveryAutosave.begin()
    notice.value = 'Preferencia guardada para todas las cotizaciones futuras de esta cuenta.'
    emit('saved')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message :
      'No se pudo guardar la configuración. No se cambiaron los destinatarios.'
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
          Esta configuración se aplicará automáticamente a todas las próximas cotizaciones
          vinculadas a esta cuenta. Guardarla no envía correos ahora.
        </p>
      </div>
      <button type="button" :disabled="saving" class="hub-outline-button hub-small"
        @click="emit('cancel')">Cerrar</button>
    </div>

    <p v-if="deliveryAutosave.status.value !== 'idle'" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ deliveryAutosave.status.value === 'restored' ? 'Se recuperó una configuración pendiente.' : deliveryAutosave.status.value === 'saved' ? 'Configuración guardada como borrador local.' : 'No se pudo conservar el borrador.' }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">Cargando configuración…</p>
    <p v-if="!authorized" role="alert" class="text-xs text-amber-600">
      Necesitás permiso para actualizar esta cuenta.
    </p>

    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="loading || saving || !authorized">
      <legend class="mb-2 text-xs font-bold">Destinatarios de todas las próximas cotizaciones</legend>
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
          <span class="text-xs text-[var(--dh-text-muted)]">A todos los contactos seleccionados, con copia al vendedor</span>
        </span>
      </label>
    </fieldset>

    <div v-if="destination === 'client'" class="space-y-2">
      <DhMultiSelect v-model="selectedContactIds" :options="contactOptions"
        label="Contactos que recibirán todas las próximas cotizaciones *"
        placeholder="Seleccioná uno o varios contactos"
        search-placeholder="Buscar contacto por nombre o correo"
        empty-text="Esta cuenta no tiene contactos activos con correo válido"
        :disabled="loading || saving || !authorized" />
      <p v-if="!emailContacts.length" class="text-xs text-amber-600">
        Esta cuenta no tiene contactos con correo válido.
        <button type="button" class="hub-text-link" @click="emit('open-contacts')">Agregar contacto</button>
      </p>
      <p v-else-if="selectedContactIds.length && !selectionValid" role="alert" class="text-xs text-amber-600">
        Hay contactos seleccionados que ya no están activos o no tienen correo válido.
      </p>
      <p v-if="selectedContacts.length" class="text-xs text-[var(--dh-text-muted)]">
        Para: {{ selectedContacts.map(contact => String(contact.email)).join(', ') }}
        · CC: {{ sellerName }}
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
        {{ saving ? 'Guardando…' : 'Guardar configuración para próximas cotizaciones' }}
      </button>
    </div>
  </form>
</template>