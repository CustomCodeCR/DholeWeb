<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PricingService } from '@/core/services/pricingService'
import type { CrmRow } from '../services/crmApi'

const props = defineProps<{
  quote: CrmRow
  contacts: CrmRow[]
  sellerName: string
}>()
const emit = defineEmits<{ (e: 'sent'): void; (e: 'cancel'): void }>()

type RecipientMode = 'seller' | 'client'
const destination = ref<RecipientMode>('seller')
const selectedContactId = ref('')
const sending = ref(false)
const error = ref('')

const emailContacts = computed(() => props.contacts.filter(contact => {
  const email = String(contact.email ?? '').trim()
  return Boolean(contact.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}))
const selectedContact = computed(() => emailContacts.value.find(
  contact => String(contact.id) === selectedContactId.value))
const canSend = computed(() => !sending.value &&
  (destination.value === 'seller' || Boolean(selectedContact.value)))

watch(() => props.quote.pricingQuoteId, () => {
  destination.value = 'seller'
  selectedContactId.value = ''
  error.value = ''
})

async function sendQuote() {
  if (!canSend.value || !props.quote.pricingQuoteId) return
  if (destination.value === 'client' && !selectedContact.value) {
    error.value = 'Seleccione un contacto de esta cuenta que tenga correo válido.'
    return
  }
  sending.value = true
  error.value = ''
  try {
    await PricingService.setRateStatus(String(props.quote.pricingQuoteId), {
      status: 'Sent',
      deliveryTarget: destination.value,
      contactId: destination.value === 'client' ? selectedContactId.value : null,
    })
    emit('sent')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message
      : 'No se pudo preparar el correo. La cotización no se marcó como enviada.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="mb-5 rounded-xl border border-[var(--dh-primary)]/35 bg-[var(--dh-card)] p-4 space-y-4"
    aria-label="Elegir destinatario de cotización" @submit.prevent="sendQuote">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="font-extrabold text-[var(--dh-text)]">
          Enviar {{ quote.quoteNumberSnapshot || 'cotización' }}
        </h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Elegí quién recibirá el PDF de esta cotización.
        </p>
      </div>
      <button type="button" :disabled="sending" class="hub-outline-button hub-small" @click="emit('cancel')">
        Cancelar
      </button>
    </div>

    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="sending">
      <legend class="mb-2 text-xs font-bold">Destinatario</legend>
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--dh-border)] p-3">
        <input v-model="destination" type="radio" value="seller" class="mt-1 accent-[var(--dh-primary)]" />
        <span class="text-sm">
          <strong class="block">Solo al vendedor</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ sellerName || 'Vendedor asignado a la cuenta' }}</span>
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
      <label for="crm-quote-delivery-contact" class="block text-xs font-bold">Contacto del cliente *</label>
      <select id="crm-quote-delivery-contact" v-model="selectedContactId" :disabled="sending"
        class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm text-[var(--dh-text)]">
        <option value="">Seleccione un contacto</option>
        <option v-for="contact in emailContacts" :key="String(contact.id)" :value="String(contact.id)">
          {{ contact.name || contact.displayName }} · {{ contact.email }}
        </option>
      </select>
      <p v-if="!emailContacts.length" class="text-xs text-amber-600">
        Esta cuenta no tiene contactos activos con un correo válido. Añada uno en la pestaña Contactos antes de enviar al cliente.
      </p>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        Para: {{ selectedContact?.email || 'Seleccione un contacto' }} · CC: {{ sellerName }}
      </p>
    </div>

    <p v-if="error" role="alert" class="text-xs font-semibold text-red-500">{{ error }}</p>
    <div class="flex justify-end">
      <button type="submit" :disabled="!canSend"
        class="rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {{ sending ? 'Preparando envío…' : 'Confirmar y enviar cotización' }}
      </button>
    </div>
  </form>
</template>
