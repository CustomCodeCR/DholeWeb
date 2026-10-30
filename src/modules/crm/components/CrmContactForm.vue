<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import { useAuthStore } from '@/core/stores/authStore'
import CrmReferencePicker from './CrmReferencePicker.vue'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import CrmPhoneInput from './CrmPhoneInput.vue'
import { crmError, crmRequest, crmUuid, type CrmRow } from '../services/crmApi'

const props = withDefaults(defineProps<{ accountId?: string }>(), { accountId: '' })
const emit = defineEmits<{
  (e: 'saved', contact: CrmRow): void
  (e: 'cancel'): void
}>()
const auth = useAuthStore()
const { locale } = useI18n()
const en = computed(() => locale.value === 'en')
const draft = reactive({
  accountId: props.accountId, firstName: '', lastName: '', jobTitle: '',
  email: '', phone: '', countryId: '', relationRole: 'CONTACT', isPrimary: false,
})
const error = ref('')
const saving = ref(false)
const operationKey = ref(crmUuid())
watch(() => props.accountId, id => { if (id) draft.accountId = id })
const valid = computed(() => Boolean(draft.accountId && draft.firstName.trim() && draft.lastName.trim()
  && auth.hasScope('crm.contact.create')))

async function save() {
  if (saving.value || !valid.value) return
  saving.value = true
  error.value = ''
  try {
    const result = await crmRequest<CrmRow>(
      '/api/crm/accounts/' + encodeURIComponent(draft.accountId) + '/contacts', 'POST', {
        firstName: draft.firstName.trim(), lastName: draft.lastName.trim(),
        // Name stays derived by CRM for older integrations and search.
        name: [draft.firstName.trim(), draft.lastName.trim()].join(' '),
        jobTitle: draft.jobTitle.trim() || null,
        email: draft.email.trim() || null, phone: draft.phone.trim() || null,
        countryId: draft.countryId || null, relationRole: draft.relationRole,
        isPrimary: draft.isPrimary,
      }, operationKey.value)
    operationKey.value = crmUuid()
    emit('saved', result)
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" data-crm-contact-form @submit.prevent="save">
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <h3 class="mb-3 text-xs font-extrabold uppercase tracking-wider">
        {{ en ? 'Linked account' : 'Cuenta vinculada' }}
      </h3>
      <CrmReferencePicker v-if="!accountId" v-model="draft.accountId" resource="accounts"
        :label="en ? 'Customer account *' : 'Cliente *'" />
      <p v-else class="text-sm font-semibold">{{ en ? 'This contact will be linked to the current customer account.' : 'El contacto quedará vinculado a esta cuenta.' }}</p>
    </section>
    <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <h3 class="mb-3 text-xs font-extrabold uppercase tracking-wider">{{ en ? 'Contact details' : 'Información general' }}</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <DhInput v-model="draft.firstName" :label="en ? 'First name(s) *' : 'Nombre(s) *'" />
        <DhInput v-model="draft.lastName" :label="en ? 'Surname(s) *' : 'Apellido(s) *'" />
        <DhInput v-model="draft.jobTitle" :label="en ? 'Position / role' : 'Puesto / cargo'" />
        <DhInput v-model="draft.email" type="email" :label="en ? 'Email address' : 'Correo electrónico'" />
        <CrmPhoneInput v-model="draft.phone" :country-id="draft.countryId" :label="en ? 'Phone' : 'Teléfono'" />
        <CrmCatalogPicker v-model="draft.countryId" :label="en ? 'Country' : 'País'" catalog-group-slug="countries" />
        <label class="block space-y-2 text-xs font-bold">
          <span class="text-[var(--dh-text-muted)]">{{ en ? 'Commercial relationship' : 'Relación comercial' }}</span>
          <select v-model="draft.relationRole"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)]">
            <option value="CONTACT">Contacto</option>
            <option value="CLIENT">Cliente</option>
            <option value="PROSPECT">Cliente potencial</option>
            <option value="COLLABORATOR">Colaborador</option>
            <option value="COMPETITOR">Competencia</option>
            <option value="FORWARDING">Forwarding</option>
            <option value="SUPPLIER">Proveedor</option>
            <option value="COMMERCIAL">Comercial</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
        <div class="flex items-center sm:col-span-2">
          <DhSwitch v-model="draft.isPrimary" :label="en ? 'Primary contact' : 'Contacto principal'" />
        </div>
      </div>
    </section>
    <div class="flex flex-wrap justify-end gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
      <DhButton type="button" variant="secondary" :label="en ? 'Cancel' : 'Cancelar'" @click="emit('cancel')" />
      <DhButton type="submit" :loading="saving" :disabled="!valid || saving"
        :label="en ? 'Save contact' : 'Guardar contacto'" />
    </div>
  </form>
</template>
