<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ContactRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import type { CatalogItemDto, CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'

const DIRECTORY_GROUP_ID = 'c2920000-0000-4000-8000-000000000001'
const DIRECTORY_GROUP_SLUG = 'internal-directory'

interface DirectoryMetadata {
  department?: string | null
  extension?: string | null
  email?: string | null
  mobile?: string | null
}

interface DirectoryEntry {
  id: string
  name: string
  department: string
  extension: string
  email: string
  mobile: string
  isActive: boolean
  sortOrder: number
}

interface DirectoryForm {
  name: string
  department: string
  extension: string
  email: string
  mobile: string
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)
const entries = ref<DirectoryEntry[]>([])
const search = ref('')
const departmentFilter = ref('')
const editingId = ref<string | null>(null)
const showForm = ref(false)
const form = ref<DirectoryForm>(emptyForm())

const canBrowseAdmin = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.view))
const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update))
const canSetActive = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.setActive))
const canManage = computed(() => canCreate.value || canUpdate.value || canSetActive.value)

const departments = computed(() =>
  [...new Set(entries.value.map((entry) => entry.department).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' }),
  ),
)

const filteredEntries = computed(() => {
  const needle = normalize(search.value)
  const department = normalize(departmentFilter.value)

  return entries.value.filter((entry) => {
    if (department && normalize(entry.department) !== department) return false
    if (!needle) return true

    return [entry.name, entry.department, entry.extension, entry.email, entry.mobile]
      .some((value) => normalize(value).includes(needle))
  })
})

function emptyForm(): DirectoryForm {
  return { name: '', department: '', extension: '', email: '', mobile: '' }
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es')
}

function parseMetadata(value?: string | null): DirectoryMetadata {
  if (!value) return {}
  try {
    return JSON.parse(value) as DirectoryMetadata
  } catch {
    return {}
  }
}

function fromAdminItem(item: CatalogItemDto): DirectoryEntry {
  const metadata = parseMetadata(item.metadataJson)
  return {
    id: item.id,
    name: item.name.trim(),
    department: String(metadata.department || item.description || '').trim(),
    extension: String(metadata.extension || item.value || '').trim(),
    email: String(metadata.email || '').trim(),
    mobile: String(metadata.mobile || '').trim(),
    isActive: item.isActive,
    sortOrder: item.sortOrder,
  }
}

function fromSelectItem(item: CatalogItemSelectDto, index: number): DirectoryEntry {
  const metadata = parseMetadata(item.metadataJson)
  return {
    id: item.id,
    name: item.label.trim(),
    department: String(metadata.department || '').trim(),
    extension: String(metadata.extension || item.value || '').trim(),
    email: String(metadata.email || '').trim(),
    mobile: String(metadata.mobile || '').trim(),
    isActive: item.isActive,
    sortOrder: (index + 1) * 10,
  }
}

function normalizeMobile(value: string) {
  const text = value.trim()
  if (!text) return ''
  const digits = text.replace(/\D/g, '')
  if (digits.length === 8) return `+506 ${digits.slice(0, 4)}-${digits.slice(4)}`
  if (digits.length === 11 && digits.startsWith('506')) {
    return `+506 ${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return text
}

function phoneHref(value: string) {
  const first = value.split('/')[0]?.trim() || value
  const sanitized = first.replace(/[^+\d]/g, '')
  return sanitized ? `tel:${sanitized}` : undefined
}

function employeeMetadata(payload: DirectoryForm) {
  const mobile = normalizeMobile(payload.mobile)
  return JSON.stringify({
    department: payload.department.trim(),
    extension: payload.extension.trim(),
    email: payload.email.trim(),
    mobile: mobile || null,
  })
}

async function loadDirectory() {
  loading.value = true
  try {
    if (canBrowseAdmin.value) {
      const response = await CatalogItemsService.browsePaged({
        pageNumber: 1,
        pageSize: 250,
        catalogGroupId: DIRECTORY_GROUP_ID,
        isActive: null,
      })
      entries.value = response.items.map(fromAdminItem)
    } else {
      const response = await CatalogItemsService.select({ catalogGroupSlug: DIRECTORY_GROUP_SLUG })
      entries.value = response.map(fromSelectItem)
    }

    entries.value.sort((a, b) =>
      a.department.localeCompare(b.department, 'es', { sensitivity: 'base' }) ||
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el directorio de extensiones.')
  } finally {
    loading.value = false
  }
}

function startCreate() {
  if (!canCreate.value) return
  editingId.value = null
  form.value = emptyForm()
  showForm.value = true
}

function startEdit(entry: DirectoryEntry) {
  if (!canUpdate.value) return
  editingId.value = entry.id
  form.value = {
    name: entry.name,
    department: entry.department,
    extension: entry.extension,
    email: entry.email,
    mobile: entry.mobile,
  }
  showForm.value = true
}

function cancelEdit() {
  editingId.value = null
  form.value = emptyForm()
  showForm.value = false
}

async function saveEntry() {
  const payload = {
    name: form.value.name.trim(),
    department: form.value.department.trim(),
    extension: form.value.extension.trim(),
    email: form.value.email.trim(),
    mobile: normalizeMobile(form.value.mobile),
  }

  if (!payload.name || !payload.department || !payload.extension) {
    toastStore.warning(
      'Datos incompletos',
      'Nombre, departamento y extensión son obligatorios.',
    )
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      const current = entries.value.find((entry) => entry.id === editingId.value)
      if (!current) return

      await CatalogItemsService.update(editingId.value, {
        name: payload.name,
        description: payload.department,
        value: payload.extension,
        metadataJson: employeeMetadata(payload),
        sortOrder: current.sortOrder,
      })
      toastStore.success('Empleado actualizado', `${payload.name} se actualizó en el directorio.`)
    } else {
      const nextSortOrder = entries.value.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 10
      await CatalogItemsService.createForGroup(DIRECTORY_GROUP_ID, {
        name: payload.name,
        slug: null,
        description: payload.department,
        value: payload.extension,
        metadataJson: employeeMetadata(payload),
        sortOrder: nextSortOrder,
        isSystem: false,
      })
      toastStore.success('Empleado agregado', `${payload.name} se agregó al directorio.`)
    }

    cancelEdit()
    await loadDirectory()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el empleado en el directorio.')
  } finally {
    saving.value = false
  }
}

async function toggleActive(entry: DirectoryEntry) {
  if (!canSetActive.value) return
  try {
    await CatalogItemsService.setActive(entry.id, { isActive: !entry.isActive })
    toastStore.success(
      entry.isActive ? 'Empleado ocultado' : 'Empleado activado',
      `${entry.name} ${entry.isActive ? 'dejó de mostrarse en el directorio general' : 'volvió a estar disponible'}.`,
    )
    await loadDirectory()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del empleado.')
  }
}

onMounted(loadDirectory)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Directorio de extensiones"
      subtitle="Consulte empleados, departamentos, extensiones, correos y celulares internos."
      :icon="ContactRound"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton
            label="Actualizar"
            variant="secondary"
            :icon="RefreshCw"
            :loading="loading"
            @click="loadDirectory"
          />
          <DhButton
            v-if="canCreate"
            label="Agregar empleado"
            :icon="Plus"
            @click="startCreate"
          />
        </div>
      </template>
    </DhPageHeader>

    <section
      v-if="showForm && (canCreate || canUpdate)"
      class="dh-glass dh-liquid rounded-[32px] p-5 sm:p-6"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">
            {{ editingId ? 'Editar empleado' : 'Agregar empleado' }}
          </h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Los cambios se guardan en Config y quedan disponibles para todo Dhole.
          </p>
        </div>
        <DhButton label="Cancelar" variant="secondary" @click="cancelEdit" />
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DhInput v-model="form.name" label="Nombre" placeholder="Nombre del empleado" />
        <DhInput v-model="form.department" label="Departamento" placeholder="Ej. Desarrollo" />
        <DhInput v-model="form.extension" label="Extensión" placeholder="Ej. 135" />
        <DhInput v-model="form.email" type="email" label="Correo" placeholder="correo@empresa.com" />
        <DhInput v-model="form.mobile" label="Celular" placeholder="+506 0000-0000" />
      </div>

      <div class="mt-5 flex justify-end">
        <DhButton
          :label="editingId ? 'Guardar cambios' : 'Agregar al directorio'"
          :loading="saving"
          @click="saveEntry"
        />
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5 sm:p-6">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] lg:items-end">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-4 top-[2.35rem] h-4 w-4 text-[var(--dh-text-muted)]"
          />
          <DhInput
            v-model="search"
            label="Buscar"
            placeholder="Nombre, extensión, correo o celular"
            class="[&_input]:pl-10"
          />
        </div>

        <label class="block">
          <span
            class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
          >
            Departamento
          </span>
          <select
            v-model="departmentFilter"
            class="h-11 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-semibold text-[var(--dh-text)] outline-none shadow-[var(--dh-shadow-sm)] focus:border-[var(--dh-primary)]"
          >
            <option value="">Todos los departamentos</option>
            <option v-for="department in departments" :key="department" :value="department">
              {{ department }}
            </option>
          </select>
        </label>

        <div class="pb-2 text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
          {{ filteredEntries.length }} de {{ entries.length }}
        </div>
      </div>
    </section>

    <section class="hidden overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] lg:block">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1040px] text-sm">
          <thead class="bg-black/[0.035] text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
            <tr>
              <th class="px-5 py-4 text-left">Empleado</th>
              <th class="px-5 py-4 text-left">Departamento</th>
              <th class="px-5 py-4 text-center">Extensión</th>
              <th class="px-5 py-4 text-left">Correo</th>
              <th class="px-5 py-4 text-left">Celular</th>
              <th v-if="canBrowseAdmin" class="px-5 py-4 text-center">Estado</th>
              <th v-if="canManage" class="px-5 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in filteredEntries"
              :key="entry.id"
              class="border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]"
              :class="!entry.isActive ? 'opacity-50' : ''"
            >
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
                    <UserRound class="h-4 w-4" />
                  </div>
                  <strong class="text-[var(--dh-text)]">{{ entry.name }}</strong>
                </div>
              </td>
              <td class="px-5 py-4 font-semibold text-[var(--dh-text-soft)]">{{ entry.department || '—' }}</td>
              <td class="px-5 py-4 text-center">
                <span class="inline-flex min-w-14 justify-center rounded-full dh-bg-primary-soft px-3 py-1.5 font-black text-[var(--dh-primary)]">
                  {{ entry.extension || '—' }}
                </span>
              </td>
              <td class="px-5 py-4">
                <a
                  v-if="entry.email"
                  :href="`mailto:${entry.email}`"
                  class="inline-flex items-center gap-2 font-semibold text-[var(--dh-text)] hover:text-[var(--dh-primary)]"
                >
                  <Mail class="h-4 w-4 shrink-0" />
                  {{ entry.email }}
                </a>
                <span v-else>—</span>
              </td>
              <td class="px-5 py-4">
                <a
                  v-if="entry.mobile"
                  :href="phoneHref(entry.mobile)"
                  class="inline-flex items-center gap-2 font-semibold text-[var(--dh-text)] hover:text-[var(--dh-primary)]"
                >
                  <Phone class="h-4 w-4 shrink-0" />
                  {{ entry.mobile }}
                </a>
                <span v-else class="text-[var(--dh-text-muted)]">—</span>
              </td>
              <td v-if="canBrowseAdmin" class="px-5 py-4 text-center">
                <span
                  class="rounded-full px-3 py-1 text-xs font-black"
                  :class="entry.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-[var(--dh-text-muted)]'"
                >
                  {{ entry.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td v-if="canManage" class="px-5 py-4">
                <div class="flex justify-end gap-2">
                  <button
                    v-if="canUpdate"
                    type="button"
                    class="rounded-xl border border-[var(--dh-border)] p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-primary)]"
                    title="Editar empleado"
                    @click="startEdit(entry)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    v-if="canSetActive"
                    type="button"
                    class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-black text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)]"
                    @click="toggleActive(entry)"
                  >
                    {{ entry.isActive ? 'Ocultar' : 'Activar' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="grid gap-3 lg:hidden">
      <article
        v-for="entry in filteredEntries"
        :key="entry.id"
        class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]"
        :class="!entry.isActive ? 'opacity-50' : ''"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl dh-bg-primary-soft text-[var(--dh-primary)]">
                <UserRound class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <h3 class="truncate font-black text-[var(--dh-text)]">{{ entry.name }}</h3>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ entry.department || 'Sin departamento' }}</p>
              </div>
            </div>
          </div>
          <span class="rounded-full dh-bg-primary-soft px-3 py-1.5 text-sm font-black text-[var(--dh-primary)]">
            Ext. {{ entry.extension || '—' }}
          </span>
        </div>

        <div class="mt-4 grid gap-2 text-sm">
          <a
            v-if="entry.email"
            :href="`mailto:${entry.email}`"
            class="flex min-w-0 items-center gap-2 font-semibold text-[var(--dh-text-soft)]"
          >
            <Mail class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            <span class="truncate">{{ entry.email }}</span>
          </a>
          <div v-else class="flex items-center gap-2 text-[var(--dh-text-muted)]">
            <Mail class="h-4 w-4" /> Sin correo
          </div>
          <a
            v-if="entry.mobile"
            :href="phoneHref(entry.mobile)"
            class="flex items-center gap-2 font-semibold text-[var(--dh-text-soft)]"
          >
            <Phone class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            {{ entry.mobile }}
          </a>
        </div>

        <div v-if="canManage" class="mt-4 flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] pt-3">
          <DhButton
            v-if="canUpdate"
            label="Editar"
            variant="secondary"
            :icon="Pencil"
            size="sm"
            @click="startEdit(entry)"
          />
          <DhButton
            v-if="canSetActive"
            :label="entry.isActive ? 'Ocultar' : 'Activar'"
            variant="secondary"
            size="sm"
            @click="toggleActive(entry)"
          />
        </div>
      </article>
    </section>

    <div
      v-if="!loading && filteredEntries.length === 0"
      class="rounded-[28px] border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-12 text-center"
    >
      <ContactRound class="mx-auto h-9 w-9 text-[var(--dh-text-muted)]" />
      <h3 class="mt-3 font-black text-[var(--dh-text)]">No se encontraron extensiones</h3>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
        Cambie el nombre buscado o el filtro de departamento.
      </p>
    </div>
  </section>
</template>
