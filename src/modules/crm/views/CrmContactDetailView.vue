<script setup lang="ts">
import CrmModuleNavigation from '../components/CrmModuleNavigation.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ContactRound, Mail, Pencil, Phone, RefreshCw, ShieldCheck, Building2, UserRound } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { DhDrawer } from '@/shared/components/organisms'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmPhoneInput from '../components/CrmPhoneInput.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { crmGet, crmPatch, crmRequest, crmError, type CrmRow } from '../services/crmApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const en = computed(() => locale.value === 'en')
const contact = ref<CrmRow | null>(null)
const linkedAccounts = ref<Array<{ accountId: string; accountName: string }>>([])
const preferences = ref<CrmRow | null>(null)
const loading = ref(false)
const saving = ref(false)
const editOpen = ref(false)
const error = ref('')
const success = ref('')
const draft = ref({ firstName: '', lastName: '', jobTitle: '', email: '', phone: '', countryId: '' })
const contactId = computed(() => String(route.params.id ?? ''))
const display = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value : '—'
async function load() {
  if (!auth.hasScope('crm.contact.read')) return
  loading.value = true
  error.value = ''
  try {
    contact.value = await crmGet('contacts', contactId.value)
    try {
      linkedAccounts.value = await crmRequest<Array<{ accountId: string; accountName: string }>>(
        '/api/crm/contacts/' + encodeURIComponent(contactId.value) + '/accounts')
    } catch { linkedAccounts.value = [] }
    try { preferences.value = await crmRequest<CrmRow | null>('/api/crm/contacts/' + encodeURIComponent(contactId.value) + '/preferences') }
    catch { preferences.value = null }
  } catch (e) { contact.value = null; linkedAccounts.value = []; error.value = crmError(e) }
  finally { loading.value = false }
}
function edit() {
  if (!contact.value) return
  // Legacy full names are not split automatically: compound surnames are ambiguous.
  draft.value = { firstName: String(contact.value.firstName || ''), lastName: String(contact.value.lastName || ''),
    jobTitle: String(contact.value.jobTitle || ''),
    email: String(contact.value.email || ''), phone: String(contact.value.phone || ''),
    countryId: String(contact.value.countryId || '') }
  editOpen.value = true
}
async function save() {
  if (!contact.value || !draft.value.firstName.trim() || !draft.value.lastName.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await crmPatch('contacts', contactId.value, {
      expectedVersion: contact.value.rowVersion,
      firstName: draft.value.firstName.trim(), lastName: draft.value.lastName.trim(),
      name: [draft.value.firstName.trim(), draft.value.lastName.trim()].join(' '),
      jobTitle: draft.value.jobTitle.trim() || null, email: draft.value.email.trim() || null,
      phone: draft.value.phone.trim() || null,
      countryId: draft.value.countryId || null,
    })
    editOpen.value = false
    await load()
    success.value = en.value ? 'Contact updated.' : 'Contacto actualizado.'
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
onMounted(load)
watch(contactId, load)
</script>

<template>
  <main class="mx-auto w-full max-w-[1650px] space-y-3 p-3 text-[var(--dh-text)] sm:p-5" data-crm-contact-detail>
    <CrmModuleNavigation />
    <DhButton :icon="ArrowLeft" :label="en ? 'Contacts' : 'Volver a contactos'" variant="secondary" @click="router.push('/crm/contacts')" />
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-emerald-500">{{ success }}</p>
    <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando contacto…</p>
    <template v-if="contact">
      <header class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <div class="rounded-xl bg-[var(--dh-primary)]/10 p-3 text-[var(--dh-primary)]"><ContactRound class="h-6 w-6" /></div>
            <div class="min-w-0">
              <p class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--dh-text-muted)]">CRM · Contacto</p>
              <h1 class="truncate text-xl font-extrabold">{{ display(contact.name) }}</h1>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ display(contact.jobTitle) }} <span v-if="linkedAccounts.length">· {{ linkedAccounts[0]?.accountName }}</span></p>
            </div>
          </div>
          <div class="flex gap-2">
            <DhButton :icon="RefreshCw" label="Actualizar" variant="secondary" :disabled="loading" @click="load" />
            <DhButton v-if="auth.hasScope('crm.contact.update')" :icon="Pencil" label="Editar" @click="edit" />
          </div>
        </div>
      </header>
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)_minmax(255px,.7fr)]">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" />Información general</h2>
          <dl class="divide-y divide-[var(--dh-border)]">
            <div v-for="item in [
              {label:'Nombre(s)',value:contact.firstName}, {label:'Apellido(s)',value:contact.lastName},
              {label:'Nombre completo',value:contact.name}, {label:'Puesto',value:contact.jobTitle},
              {label:'Correo',value:contact.email}, {label:'Teléfono',value:contact.phone},
              {label:'Estado',value:contact.status},
            ]" :key="item.label" class="grid grid-cols-[42%_minmax(0,1fr)] gap-3 py-3 text-xs">
              <dt class="font-semibold text-[var(--dh-text-muted)]">{{ item.label }}</dt><dd class="break-words font-semibold">{{ display(item.value) }}</dd>
            </div>
          </dl>
        </section>
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold"><ShieldCheck class="h-4 w-4 text-[var(--dh-primary)]" />Preferencias de comunicación</h2>
          <p v-if="!preferences" class="text-xs text-[var(--dh-text-muted)]">Aún no hay preferencias registradas.</p>
          <dl v-else class="divide-y divide-[var(--dh-border)]">
            <div v-for="item in [
              {label:'Canal preferido',value:preferences.preferredChannel},
              {label:'Zona horaria',value:preferences.timezoneId},
              {label:'Frecuencia (días)',value:preferences.frequencyDays},
              {label:'No contactar',value:preferences.doNotContact ? 'Sí' : 'No'},
            ]" :key="item.label" class="grid grid-cols-[42%_minmax(0,1fr)] gap-3 py-3 text-xs">
              <dt class="text-[var(--dh-text-muted)]">{{ item.label }}</dt><dd class="font-semibold">{{ item.value ?? '—' }}</dd>
            </div>
          </dl>
        </section>
        <aside class="space-y-3">
          <section v-if="linkedAccounts.length" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h2 class="mb-3 flex items-center gap-2 text-sm font-bold"><Building2 class="h-4 w-4 text-[var(--dh-primary)]" />Cuenta relacionada</h2>
            <RouterLink v-for="account in linkedAccounts" :key="account.accountId"
              :to="'/crm/accounts/' + encodeURIComponent(account.accountId)"
              class="block break-words py-1 text-sm font-semibold text-[var(--dh-primary)] hover:underline">
              {{ account.accountName }}
            </RouterLink>

          </section>
          <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h2 class="mb-3 text-sm font-bold">Comunicación</h2>
            <div class="flex flex-col gap-2">
              <a v-if="contact.email" :href="'mailto:'+encodeURIComponent(String(contact.email))" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold hover:text-[var(--dh-primary)]"><Mail class="h-4 w-4" />Enviar correo</a>
              <a v-if="contact.phone" :href="'tel:'+String(contact.phone)" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold hover:text-[var(--dh-primary)]"><Phone class="h-4 w-4" />Llamar</a>
            </div>
          </section>
        </aside>
      </div>
    </template>
    <DhDrawer :open="editOpen" :title="en ? 'Edit contact' : 'Editar contacto'" size="md" @close="editOpen=false">
      <form class="space-y-4" @submit.prevent="save">
        <div class="grid gap-3 sm:grid-cols-2">
          <DhInput v-model="draft.firstName" label="Nombre(s) *" />
          <DhInput v-model="draft.lastName" label="Apellido(s) *" />
        </div>
        <p v-if="!contact?.firstName && !contact?.lastName" class="text-xs text-[var(--dh-text-muted)]">
          Este contacto antiguo tiene solo un nombre completo. Ingresá sus nombres y apellidos reales para guardarlos por separado.
        </p>
        <DhInput v-model="draft.jobTitle" label="Puesto / cargo" />
        <DhInput v-model="draft.email" label="Correo electrónico" type="email" />
        <div class="grid gap-3 sm:grid-cols-2">
          <CrmPhoneInput v-model="draft.phone" :country-id="draft.countryId" label="Teléfono" />
          <CrmCatalogPicker v-model="draft.countryId" label="País" catalog-group-slug="countries" />
        </div>
        <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] py-3">
          <DhButton variant="secondary" label="Cancelar" @click="editOpen=false" />
          <DhButton type="submit" :loading="saving" :disabled="!draft.firstName.trim() || !draft.lastName.trim()" label="Guardar" />
        </div>
      </form>
    </DhDrawer>
  </main>
</template>
