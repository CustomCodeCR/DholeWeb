<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ContactRound, Plus, RefreshCw, Search, UsersRound } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import CrmContactForm from '../components/CrmContactForm.vue'
import CrmArchiveAction from '../components/CrmArchiveAction.vue'
import { crmList, crmError, type CrmRow } from '../services/crmApi'

const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const en = computed(() => locale.value === 'en')
const rows = ref<CrmRow[]>([])
const search = ref('')
const query = ref('')
const page = ref(1)
const pageSize = ref(25)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const saved = ref('')
const drawer = ref(false)
const columns = computed<DhTableColumn<CrmRow>[]>(() => [
  { key: 'name', label: en.value ? 'Full name' : 'Nombre completo' },
  { key: 'accountName', label: en.value ? 'Account' : 'Cuenta / empresa' },
  { key: 'jobTitle', label: en.value ? 'Position' : 'Puesto' },
  { key: 'email', label: en.value ? 'Email' : 'Correo electrónico' },
  { key: 'phone', label: en.value ? 'Phone' : 'Teléfono' },
  { key: 'relationRole', label: en.value ? 'Relationship' : 'Relación' },
  { key: 'actions', label: en.value ? 'Actions' : 'Acciones' },
])
const visibleRows = computed<CrmRow[]>(() => rows.value.map(r => ({ ...r, name: r.name || '—',
  accountName: r.accountName || '—', jobTitle: r.jobTitle || '—',
  email: r.email || '—', phone: r.phone || '—', relationRole: r.relationRole || '—' })))
async function load() {
  if (!auth.hasScope('crm.contact.read')) return
  loading.value = true
  error.value = ''
  try {
    const response = await crmList('contacts', { q: query.value, page: page.value, pageSize: pageSize.value })
    rows.value = response.items
    total.value = response.total
  } catch (e) { rows.value = []; total.value = 0; error.value = crmError(e) }
  finally { loading.value = false }
}
function changeContactsPage(nextPage: number) {
  if (nextPage < 1 || nextPage > Math.max(1, Math.ceil(total.value / pageSize.value)) || nextPage === page.value) return
  page.value = nextPage
  void load()
}
function changeContactsPageSize(nextSize: number) {
  if (![10, 25, 50].includes(nextSize) || nextSize === pageSize.value) return
  pageSize.value = nextSize
  page.value = 1
  void load()
}
function find() { query.value = search.value.trim(); page.value = 1; void load() }
function openCreate() {
  saved.value = ''
  drawer.value = true
}
function onContactSaved(contact: CrmRow) {
  drawer.value = false
  saved.value = en.value ? 'Contact created.' : 'Contacto registrado.'
  void load()
  if (contact.id) void router.push('/crm/contacts/' + encodeURIComponent(String(contact.id)))
}

onMounted(load)
watch(locale, () => { /* localized headers recompute without reloading */ })
</script>

<template>
  <main class="mx-auto w-full max-w-[1650px] space-y-4 p-3 text-[var(--dh-text)] sm:p-6" data-crm-contacts>
    <DhPageHeader :title="en ? 'Contacts' : 'Contactos'" :subtitle="en ? 'CRM · Customers' : 'CRM · Clientes'"
      :icon="ContactRound" hide-excel-export>
      <template #actions>
        <DhButton :icon="RefreshCw" :label="en ? 'Refresh' : 'Actualizar'" variant="secondary" :disabled="loading" @click="load" />
        <DhButton v-if="auth.hasScope('crm.contact.create')" :icon="Plus" :label="en ? 'New contact' : 'Nuevo contacto'" @click="openCreate" />
      </template>
    </DhPageHeader>
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <form class="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3"
        @submit.prevent="find">
        <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
        <input v-model="search" type="search" :placeholder="en ? 'Name, email or account…' : 'Nombre, correo o cuenta…'"
          class="min-w-0 flex-1 bg-transparent py-3 text-sm text-[var(--dh-text)] outline-none" />
        <DhButton :label="en ? 'Search' : 'Buscar'" size="sm" variant="secondary" type="submit" />
      </form>
      <div class="flex items-center gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2 text-xs text-[var(--dh-text-muted)]">
        <UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />
        <strong class="text-base text-[var(--dh-text)]">{{ total }}</strong>
        {{ en ? 'visible contact relationships' : 'relaciones de contacto autorizadas' }}
      </div>
    </div>
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="saved" role="status" class="text-sm text-emerald-500">{{ saved }}</p>
    <section class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="flex items-center justify-between border-b border-[var(--dh-border)] px-4 py-3">
        <div><h2 class="text-sm font-bold">{{ en ? 'Contact directory' : 'Directorio de contactos' }}</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Contacts linked to accounts you can access' : 'Contactos vinculados a las cuentas a las que tenés acceso' }}</p></div>
      </div>
      <DhDataTable :columns="columns" :rows="visibleRows" :loading="loading"
        :empty-text="en ? 'No contacts found' : 'No hay contactos registrados para estas cuentas'"
        @row-click="router.push('/crm/contacts/' + encodeURIComponent($event.id))">
        <template #cell-name="{ value }"><strong class="text-[var(--dh-text)]">{{ value }}</strong></template>
        <template #cell-accountName="{ value, row }">
          <RouterLink :to="'/crm/accounts/' + encodeURIComponent(String(row.accountId))" class="text-[var(--dh-primary)] hover:underline" @click.stop>{{ value }}</RouterLink>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2" @click.stop>
            <DhButton label="Ver detalle" size="sm" variant="ghost"
              @click="router.push('/crm/contacts/' + encodeURIComponent(String(row.id)))" />
            <CrmArchiveAction resource="contacts" :record-id="String(row.id)"
              :row-version="Number(row.rowVersion)" :record-name="String(row.name)"
              @archived="page=1;load()" />
          </div>
        </template>
      </DhDataTable>
    </section>
    <DhPagination :page="page" :page-size="pageSize" :total="total"
      :class="loading ? 'pointer-events-none opacity-60' : ''"
      @update:page="changeContactsPage" @update:page-size="changeContactsPageSize" />
    <DhDrawer :open="drawer" :title="en ? 'New contact' : 'Nuevo contacto'" size="lg" @close="drawer=false">
      <CrmContactForm v-if="drawer" @saved="onContactSaved" @cancel="drawer=false" />    </DhDrawer>
  </main>
</template>
