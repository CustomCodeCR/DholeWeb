<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { UsersService } from '@/core/services/usersService'
import type { UserDto } from '@/core/interfaces/users'
import { crmError, crmPath, crmRequest } from '../services/crmApi'

interface ViewerGrant {
  userId: string
  grantedByUserId: string
  createdAt: string
}

const open = ref(false)
const grants = ref<ViewerGrant[]>([])
const users = ref<UserDto[]>([])
const directoryUsers = ref<UserDto[]>([])
const directoryWarning = ref('')
const hasSearched = ref(false)
const search = ref('')
const selectedUserId = ref('')
const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const authorizedUserIds = computed(() => new Set(grants.value.map(grant => grant.userId.toLowerCase())))
const eligibleUsers = computed(() => users.value.filter(user => !authorizedUserIds.value.has(user.id.toLowerCase())))
const displayUsers = computed(() => new Map(
  [...users.value, ...directoryUsers.value].map(user => [user.id.toLowerCase(), user]),
))
const accessPath = () => crmPath('institutional-viewers')

// Resolve grants against the independent Auth directory, not the current search results.
// Fetch all necessary pages so older/inactive grantees can also be identified and revoked.
async function resolveAuthorizedUsers(activeGrants: ViewerGrant[]) {
  const wanted = new Set(activeGrants.map(grant => grant.userId.toLowerCase()))
  directoryUsers.value = []
  directoryWarning.value = ''
  if (!wanted.size) return

  const matches: UserDto[] = []
  const seen = new Set<string>()
  const pageSize = 100
  try {
    for (let pageNumber = 1; wanted.size && pageNumber <= 100; pageNumber += 1) {
      const page = await UsersService.browsePaged({ pageNumber, pageSize })
      let newUsers = 0
      for (const user of page.items) {
        const id = user.id.toLowerCase()
        if (seen.has(id)) continue
        seen.add(id)
        newUsers += 1
        if (wanted.delete(id)) matches.push(user)
      }
      if (page.items.length < pageSize || newUsers === 0
        || (page.totalPages !== undefined && pageNumber >= page.totalPages)
        || (page.totalCount !== undefined && pageNumber * pageSize >= page.totalCount)) break
    }
  } catch (cause) {
    directoryWarning.value = 'No se pudieron consultar todos los usuarios del directorio: ' + crmError(cause)
  }
  directoryUsers.value = matches
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    grants.value = await crmRequest<ViewerGrant[]>(accessPath())
    await resolveAuthorizedUsers(grants.value)
  } catch (cause) {
    grants.value = []
    directoryUsers.value = []
    error.value = crmError(cause)
  } finally {
    loading.value = false
  }
}

async function searchUsers() {
  hasSearched.value = true
  searching.value = true
  error.value = ''
  try {
    const response = await UsersService.browsePaged({
      pageNumber: 1,
      pageSize: 100,
      isActive: true,
      isLocked: false,
      search: search.value.trim() || undefined,
    })
    users.value = response.items.filter(user => user.isActive && !user.isLocked)
    if (!users.value.some(user => user.id === selectedUserId.value)) selectedUserId.value = ''
  } catch (cause) {
    users.value = []
    error.value = crmError(cause)
  } finally {
    searching.value = false
  }
}

async function grant() {
  if (!selectedUserId.value || saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await crmRequest(accessPath() + '/' + encodeURIComponent(selectedUserId.value), 'PUT')
    notice.value = 'Usuario autorizado para todas las cuentas de Castro Fallas.'
    selectedUserId.value = ''
    await refresh()
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}

async function revoke(userId: string) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await crmRequest(accessPath() + '/' + encodeURIComponent(userId), 'DELETE')
    notice.value = 'Acceso revocado.'
    await refresh()
  } catch (cause) {
    error.value = crmError(cause)
  } finally {
    saving.value = false
  }
}

onMounted(() => void refresh())
</script>

<template>
  <section data-crm-institutional-viewers
    class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-[var(--dh-text)]">
    <button type="button" class="flex w-full items-center justify-between gap-3 text-left"
      :aria-expanded="open" @click="open = !open">
      <span class="font-bold">Acceso general a cuentas de Castro Fallas</span>
      <span class="text-xs font-bold text-[var(--dh-text-muted)]">
        {{ grants.length }} usuarios autorizados · {{ open ? 'Ocultar' : 'Administrar' }}
      </span>
    </button>
    <div v-if="open" class="mt-4 space-y-4">
      <p class="text-xs text-[var(--dh-text-muted)]">
        Los usuarios autorizados aquí pueden consultar todas las cuentas asignadas a Castro Fallas,
        junto con los contactos, análisis y crédito a los que tengan permisos de módulo. No se autoriza por cliente.
      </p>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <p v-if="notice" role="status" class="text-sm text-emerald-600">{{ notice }}</p>
      <p v-if="directoryWarning" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ directoryWarning }}</p>
      <form class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="searchUsers">
        <input v-model="search" type="search" placeholder="Buscar usuario por nombre o correo"
          class="min-w-0 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm"
          aria-label="Buscar usuario autorizado" />
        <button type="submit" :disabled="searching"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-sm font-bold">
          {{ searching ? 'Buscando…' : 'Buscar' }}
        </button>
      </form>
      <form class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="grant">
        <select v-model="selectedUserId" aria-label="Usuario para autorizar"
          class="min-w-0 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm">
          <option value="">Seleccione un usuario activo</option>
          <option v-for="user in eligibleUsers" :key="user.id" :value="user.id">
            {{ user.displayName }} · {{ user.email }}
          </option>
        </select>
        <button type="submit" :disabled="!selectedUserId || saving"
          class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          Autorizar acceso
        </button>
      </form>
      <p v-if="hasSearched && !searching && !eligibleUsers.length"
        class="text-xs text-[var(--dh-text-muted)]">
        {{ users.length ? 'Los usuarios encontrados ya tienen acceso.' : 'No se encontraron usuarios activos para autorizar.' }}
      </p>
      <p v-if="loading" class="text-xs text-[var(--dh-text-muted)]">Cargando autorizaciones…</p>
      <p v-else-if="!grants.length" class="text-xs text-[var(--dh-text-muted)]">
        No hay usuarios autorizados globalmente.
      </p>
      <ul v-else class="divide-y divide-[var(--dh-border)]">
        <li v-for="grant in grants" :key="grant.userId"
          class="flex flex-wrap items-center justify-between gap-2 py-2">
          <div class="min-w-0 flex-1" :title="grant.userId">
            <p class="break-words text-sm font-semibold">
              {{ displayUsers.get(grant.userId.toLowerCase())?.displayName
                || displayUsers.get(grant.userId.toLowerCase())?.userName
                || 'Usuario no disponible' }}
            </p>
            <p class="break-words text-xs text-[var(--dh-text-muted)]">
              {{ displayUsers.get(grant.userId.toLowerCase())?.email
                || 'No se encontró este usuario en el directorio' }}
            </p>
          </div>
          <button type="button" :disabled="saving" @click="revoke(grant.userId)"
            class="rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            Revocar
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
