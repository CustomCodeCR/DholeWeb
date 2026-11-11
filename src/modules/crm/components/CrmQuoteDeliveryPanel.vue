<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PricingService } from '@/core/services/pricingService'
import type { CrmRow } from '../services/crmApi'

const props = defineProps<{
  quote: CrmRow | null
  quotes: CrmRow[]
  contacts: CrmRow[]
  sellerName: string
  authorized: boolean
  quotesLoading?: boolean
  quotesError?: string
}>()
const emit = defineEmits<{
  (e: 'sent'): void
  (e: 'cancel'): void
  (e: 'open-contacts'): void
  (e: 'open-quotes'): void
}>()

type RecipientMode = 'seller' | 'client'
const destination = ref<RecipientMode>('seller')
const selectedQuoteId = ref(String(props.quote?.pricingQuoteId ?? ''))
const selectedContactId = ref('')
const sending = ref(false)
const error = ref('')

const selectedQuote = computed(() => props.quotes.find(
  quote => String(quote.pricingQuoteId) === selectedQuoteId.value) ?? null)
const emailContacts = computed(() => props.contacts.filter(contact => {
  const email = String(contact.email ?? '').trim()
  return Boolean(contact.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}))
const selectedContact = computed(() => emailContacts.value.find(
  contact => String(contact.id) === selectedContactId.value))
const canSend = computed(() => props.authorized && !sending.value && !props.quotesLoading &&
  Boolean(selectedQuote.value) &&
  (destination.value === 'seller' || Boolean(selectedContact.value)))

watch(() => props.quote?.pricingQuoteId, quoteId => {
  selectedQuoteId.value = String(quoteId ?? '')
  destination.value = 'seller'
  selectedContactId.value = ''
  error.value = ''
})
watch(() => props.quotes, quotes => {
  if (selectedQuoteId.value && !quotes.some(
    quote => String(quote.pricingQuoteId) === selectedQuoteId.value)) {
    selectedQuoteId.value = ''
  }
})

async function sendQuote() {
  if (!canSend.value || !selectedQuote.value) return
  sending.value = true
  error.value = ''
  try {
    await PricingService.setRateStatus(String(selectedQuote.value.pricingQuoteId), {
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
  <form id="crm-account-quote-delivery"
    class="rounded-xl border border-[var(--dh-primary)]/35 bg-[var(--dh-card)] p-4 shadow-sm space-y-4"
    aria-label="Elegir destinatario de cotización" @submit.prevent="sendQuote">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-extrabold text-[var(--dh-text)]">Enviar cotización</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Seleccioná la QUO y decidí si el PDF se envía al vendedor o a un contacto del cliente.
        </p>
      </div>
      <button type="button" :disabled="sending" class="hub-outline-button hub-small"
        aria-label="Cerrar envío de cotización" @click="emit('cancel')">Cerrar</button>
    </div>

    <p v-if="!authorized" class="text-sm text-amber-600" role="alert">
      No tenés los permisos necesarios para enviar cotizaciones de esta cuenta.
    </p>

    <div class="space-y-2">
      <label for="crm-quote-to-send" class="block text-xs font-bold">Cotización disponible *</label>
      <select id="crm-quote-to-send" v-model="selectedQuoteId" :disabled="sending || quotesLoading || !authorized"
        class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm text-[var(--dh-text)]">
        <option value="">Seleccioná la cotización</option>
        <option v-for="item in quotes" :key="String(item.pricingQuoteId)"
          :value="String(item.pricingQuoteId)">
          {{ item.quoteNumberSnapshot || item.pricingQuoteId }} · {{ item.shipmentModeSnapshot || 'QUO' }}
        </option>
      </select>
      <p v-if="quotesLoading" role="status" class="text-xs text-[var(--dh-text-muted)]">
        Cargando cotizaciones vinculadas…
      </p>
      <p v-else-if="quotesError" role="alert" class="text-xs text-amber-600">
        {{ quotesError }}
      </p>
      <div v-else-if="!quotes.length" class="space-y-2 text-xs text-[var(--dh-text-muted)]">
        <p>Esta cuenta aún no tiene cotizaciones disponibles para enviar. Podés crear o vincular
          una QUO y después elegir a quién enviarla.</p>
        <button type="button" class="hub-text-link" @click="emit('open-quotes')">
          Ir a Cotizaciones
        </button>
      </div>
    </div>

    <fieldset class="grid gap-3 sm:grid-cols-2" :disabled="sending || !authorized">
      <legend class="mb-2 text-xs font-bold">¿A quién enviar?</legend>
      <label class="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--dh-border)] p-3">
        <input v-model="destination" type="radio" value="seller" class="mt-1 accent-[var(--dh-primary)]" />
        <span class="text-sm">
          <strong class="block">Solo al vendedor</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">
            {{ sellerName || 'Vendedor asignado a la cuenta' }}
          </span>
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
      <select id="crm-quote-delivery-contact" v-model="selectedContactId"
        :disabled="sending || !authorized"
        class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-sm text-[var(--dh-text)]">
        <option value="">Seleccioná un contacto</option>
        <option v-for="contact in emailContacts" :key="String(contact.id)" :value="String(contact.id)">
          {{ contact.name || contact.displayName }} · {{ contact.email }}
        </option>
      </select>
      <div v-if="!emailContacts.length" class="space-y-2">
        <p class="text-xs text-amber-600">
          No hay contactos con correo válido vinculados a esta cuenta.
        </p>
        <button type="button" class="hub-text-link" @click="emit('open-contacts')">
          Ir a Contactos para añadir uno
        </button>
      </div>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        Para: {{ selectedContact?.email || 'Seleccioná un contacto' }} · CC: {{ sellerName }}
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
