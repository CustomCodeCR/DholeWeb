<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ContactRound, Mail, Pencil, Phone, RefreshCw, ShieldCheck, CalendarClock, UserRound } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { DhDrawer } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { crmGet, crmPatch, crmRequest, crmError, type CrmRow } from '../services/crmApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const en = computed(() => locale.value === 'en')
const contact = ref<CrmRow | null>(null)
const preferences = ref<CrmRow | null>(null)
const activeTab = ref<'summary' | 'details' | 'preferences'>('summary')
const contactTabs = [
  { key: 'summary', label: 'Resumen' }, { key: 'details', label: 'Detalles' },
  { key: 'preferences', label: 'Preferencias de contacto' },
] as const
const loading = ref(false)
const saving = ref(false)
const editOpen = ref(false)
const error = ref('')
const success = ref('')
const draft = ref({ name: '', jobTitle: '', email: '', phone: '' })
const contactId = computed(() => String(route.params.id ?? ''))
const display = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value : '—'
async function load() {
  if (!auth.hasScope('crm.contact.read')) return
  loading.value = true
  error.value = ''
  try {
    contact.value = await crmGet('contacts', contactId.value)
    try { preferences.value = await crmRequest<CrmRow | null>('/api/crm/contacts/' + encodeURIComponent(contactId.value) + '/preferences') }
    catch { preferences.value = null }
  } catch (e) { contact.value = null; error.value = crmError(e) }
  finally { loading.value = false }
}
function edit() {
  if (!contact.value) return
  draft.value = { name: String(contact.value.name || ''), jobTitle: String(contact.value.jobTitle || ''),
    email: String(contact.value.email || ''), phone: String(contact.value.phone || '') }
  editOpen.value = true
}
async function save() {
  if (!contact.value || !draft.value.name.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await crmPatch('contacts', contactId.value, {
      expectedVersion: contact.value.rowVersion, name: draft.value.name.trim(),
      jobTitle: draft.value.jobTitle.trim() || null, email: draft.value.email.trim() || null,
      phone: draft.value.phone.trim() || null,
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
    <DhButton :icon="ArrowLeft" :label="en ? 'Contacts' : 'Volver a contactos'" variant="secondary" @click="router.push('/crm/contacts')" />
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-emerald-500">{{ success }}</p>
    <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">Cargando contacto…</p>
    <template v-if="contact">
      <header class="sticky top-1 z-20 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div class="flex min-w-0 items-center gap-3">
            <div class="rounded-xl bg-[var(--dh-primary)]/10 p-3 text-[var(--dh-primary)]"><ContactRound class="h-6 w-6" /></div>
            <div class="min-w-0">
              <p class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--dh-text-muted)]">CRM · Contacto</p>
              <h1 class="truncate text-xl font-extrabold">{{ display(contact.name) }}</h1>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ display(contact.jobTitle) }} · {{ display(contact.status) }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <DhButton :icon="RefreshCw" label="Actualizar" variant="secondary" :disabled="loading" @click="load" />
            <DhButton v-if="auth.hasScope('crm.contact.update')" :icon="Pencil" label="Editar" @click="edit" />
          </div>
        </div>
        <nav role="tablist" aria-label="Detalle del contacto" class="flex gap-2 border-t border-[var(--dh-border)] px-3">
          <button v-for="tab in contactTabs" :key="tab.key" role="tab" type="button" :aria-selected="activeTab===tab.key"
            class="border-b-2 px-3 py-3 text-xs font-bold"
            :class="activeTab===tab.key ? 'border-[var(--dh-primary)] text-[var(--dh-primary)]' : 'border-transparent text-[var(--dh-text-muted)]'"
            @click="activeTab=tab.key">{{ tab.label }}</button>
        </nav>
      </header>
      <div class="grid items-start gap-3 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.12fr)_minmax(250px,.78fr)]">
        <section v-if="activeTab==='summary' || activeTab==='details'" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" />Información general</h2>
          <dl class="divide-y divide-[var(--dh-border)]">
            <div v-for="item in [
              {label:'Nombre completo',value:contact.name}, {label:'Puesto',value:contact.jobTitle},
              {label:'Correo',value:contact.email}, {label:'Teléfono',value:contact.phone},
              {label:'Estado',value:contact.status},
            ]" :key="item.label" class="grid grid-cols-[42%_minmax(0,1fr)] gap-3 py-3 text-xs">
              <dt class="font-semibold text-[var(--dh-text-muted)]">{{ item.label }}</dt><dd class="break-words font-semibold">{{ display(item.value) }}</dd>
            </div>
          </dl>
        </section>
        <section v-if="activeTab==='summary' || activeTab==='preferences'" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
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
          <section class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
            <h2 class="mb-3 text-sm font-bold">Acciones rápidas</h2>
            <div class="flex flex-col gap-2">
              <a v-if="contact.email" :href="'mailto:'+encodeURIComponent(String(contact.email))" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold hover:text-[var(--dh-primary)]"><Mail class="h-4 w-4" />Enviar correo</a>
              <a v-if="contact.phone" :href="'tel:'+String(contact.phone)" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold hover:text-[var(--dh-primary)]"><Phone class="h-4 w-4" />Llamar</a>
              <RouterLink to="/crm/followups" class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold hover:text-[var(--dh-primary)]"><CalendarClock class="h-4 w-4" />Ver seguimientos</RouterLink>
            </div>
          </section>
        </aside>
      </div>
    </template>
    <DhDrawer :open="editOpen" :title="en ? 'Edit contact' : 'Editar contacto'" size="md" @close="editOpen=false">
      <form class="space-y-4" @submit.prevent="save">
        <DhInput v-model="draft.name" label="Nombre completo *" />
        <DhInput v-model="draft.jobTitle" label="Puesto / cargo" />
        <DhInput v-model="draft.email" label="Correo electrónico" type="email" />
        <DhInput v-model="draft.phone" label="Teléfono" />
        <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] py-3">
          <DhButton variant="secondary" label="Cancelar" @click="editOpen=false" />
          <DhButton type="submit" :loading="saving" :disabled="!draft.name.trim()" label="Guardar" />
        </div>
      </form>
    </DhDrawer>
  </main>
</template>
