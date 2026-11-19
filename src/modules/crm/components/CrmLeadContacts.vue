<script setup lang="ts">
import { ref, watch } from 'vue'
import { DhButton, DhInput, DhSwitch } from '@/shared/components/atoms'
import CrmPhoneInput from './CrmPhoneInput.vue'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import { crmError, crmPath, crmRequest, type CrmRow } from '../services/crmApi'

type ContactDraft = {
  firstName: string; lastName: string; jobTitle: string; email: string; phone: string
  countryId: string; isPrimary: boolean; isOperationsContact: boolean
}
const props = withDefaults(defineProps<{
  leadId: string; countryId?: string; canCreate: boolean; canEdit: boolean; converted?: boolean
}>(), { countryId: '', converted: false })
const emit = defineEmits<{ changed: [] }>()
const contacts = ref<CrmRow[]>([])
const busy = ref(false)
const saving = ref(false)
const error = ref('')
const editingId = ref('')
const editorOpen = ref(false)
const expectedVersion = ref(0)
const draft = ref<ContactDraft>(emptyContact())
let requestVersion = 0
function emptyContact(): ContactDraft {
  return { firstName: '', lastName: '', jobTitle: '', email: '', phone: '',
    countryId: props.countryId, isPrimary: false, isOperationsContact: false }
}
async function loadContacts() {
  const generation = ++requestVersion
  busy.value = true
  try {
    const rows = await crmRequest<CrmRow[]>(crmPath('leads', props.leadId, 'contacts'))
    if (generation === requestVersion) {
      contacts.value = Array.isArray(rows) ? rows : []
      error.value = ''
    }
  } catch (e) {
    if (generation === requestVersion) error.value = crmError(e)
  } finally { if (generation === requestVersion) busy.value = false }
}
watch(() => props.leadId, () => { editorOpen.value = false; void loadContacts() }, { immediate: true })
function createContact() {
  editingId.value = ''
  expectedVersion.value = 0
  draft.value = emptyContact()
  editorOpen.value = true
}
function editContact(contact: CrmRow) {
  editingId.value = String(contact.id)
  expectedVersion.value = Number(contact.rowVersion ?? 0)
  draft.value = {
    firstName: String(contact.firstName ?? ''), lastName: String(contact.lastName ?? ''),
    jobTitle: String(contact.jobTitle ?? ''), email: String(contact.email ?? ''),
    phone: String(contact.phone ?? ''), countryId: String(contact.countryId ?? props.countryId),
    isPrimary: Boolean(contact.isPrimary), isOperationsContact: Boolean(contact.isOperationsContact),
  }
  editorOpen.value = true
}
async function saveContact() {
  if (saving.value || !draft.value.firstName.trim() || !draft.value.lastName.trim()) return
  saving.value = true; error.value = ''
  try {
    const payload = { ...draft.value, countryId: draft.value.countryId || props.countryId || null }
    if (editingId.value) {
      await crmRequest(crmPath('leads', props.leadId, 'contacts') + '/' + encodeURIComponent(editingId.value),
        'PATCH', { ...payload, expectedVersion: expectedVersion.value })
    } else {
      await crmRequest(crmPath('leads', props.leadId, 'contacts'),
        'POST', { ...payload, name: null, relationRole: 'CONTACT' })
    }
    editorOpen.value = false
    await loadContacts()
    emit('changed')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
async function removeContact(contact: CrmRow) {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    await crmRequest(crmPath('leads', props.leadId, 'contacts') + '/' + encodeURIComponent(String(contact.id)), 'DELETE')
    await loadContacts()
    emit('changed')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
</script>
<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
    data-crm-prospect-contacts>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-bold">Contactos del prospecto</h2>
        <p class="text-xs text-[var(--dh-text-muted)]">Se mantendrán vinculados al convertirlo a cuenta, sin duplicarlos.</p>
      </div>
      <DhButton v-if="canCreate && !converted" label="Nuevo contacto" size="sm" @click="createContact" />
    </div>
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
    <p v-if="busy" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando contactos…</p>
    <p v-if="!busy && !contacts.length" class="text-sm text-[var(--dh-text-muted)]">No hay contactos registrados.</p>
    <div v-for="contact in contacts" :key="String(contact.id)" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3">
      <div class="min-w-0">
        <div class="font-bold">{{ contact.name }}</div>
        <div class="text-xs text-[var(--dh-text-muted)]">{{ contact.jobTitle || 'Sin puesto' }} · {{ contact.email || contact.phone || 'Sin datos de contacto' }}</div>
        <div class="mt-1 text-xs">{{ contact.isPrimary ? 'Principal · ' : '' }}{{ contact.isOperationsContact ? 'Responsable de operaciones' : '' }}</div>
      </div>
      <div v-if="canEdit && !converted" class="flex gap-2">
        <DhButton label="Editar" size="sm" variant="secondary" @click="editContact(contact)" />
        <DhButton label="Desvincular" size="sm" variant="ghost" @click="removeContact(contact)" />
      </div>
    </div>
    <form v-if="editorOpen && !converted" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4"
      @submit.prevent="saveContact">
      <h3 class="font-bold">{{ editingId ? 'Editar contacto' : 'Nuevo contacto' }}</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <DhInput v-model="draft.firstName" label="Nombre(s) *" />
        <DhInput v-model="draft.lastName" label="Apellidos *" />
        <DhInput v-model="draft.jobTitle" label="Puesto" />
        <DhInput v-model="draft.email" label="Correo" type="email" />
        <CrmPhoneInput v-model="draft.phone" label="Teléfono" :country-id="draft.countryId || countryId" />
        <CrmCatalogPicker v-model="draft.countryId" label="País" catalog-group-slug="countries" value-kind="id" />
        <DhSwitch v-model="draft.isPrimary" label="Contacto principal" />
        <DhSwitch v-model="draft.isOperationsContact" label="Encargado de operaciones" />
      </div>
      <div class="flex justify-end gap-2">
        <DhButton label="Cancelar" variant="secondary" @click="editorOpen=false" />
        <DhButton type="submit" label="Guardar contacto" :loading="saving"
          :disabled="!draft.firstName.trim() || !draft.lastName.trim()" />
      </div>
    </form>
  </section>
</template>
