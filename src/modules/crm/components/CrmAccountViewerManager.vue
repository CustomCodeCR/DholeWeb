<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { UsersService } from '@/core/services/usersService'
import type { UserDto } from '@/core/interfaces/users'
import { crmError, crmPath, crmRequest } from '../services/crmApi'

interface ViewerGrant {
  userId: string
  grantedByUserId: string
  createdAt: string
}

const props = defineProps<{ accountId: string }>()
const open = ref(false)
const grants = ref<ViewerGrant[]>([])
const users = ref<UserDto[]>([])
const search = ref('')
const selectedUserId = ref('')
const loading = ref(false)
const searching = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const displayUsers = computed(() => new Map(users.value.map(user =>
  [user.id, user.displayName + (user.email ? ' · ' + user.email : '')])))
const accessPath = () => crmPath('accounts', props.accountId, 'viewers')

async function refresh() {
  if (!props.accountId) return
  loading.value = true
  error.value = ''
  try {
    grants.value = await crmRequest<ViewerGrant[]>(accessPath())
  } catch (cause) {
    grants.value = []
    error.value = crmError(cause)
  } finally {
    loading.value = false
  }
}

async function searchUsers() {
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
    notice.value = 'Acceso autorizado para esta cuenta.'
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

watch(() => props.accountId, () => {
  grants.value = []
  users.value = []
  selectedUserId.value = ''
  notice.value = ''
  void refresh()
})
onMounted(() => void refresh())
</script>

<template>
  <section data-crm-institutional-viewers
    class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-[var(--dh-text)]">
    <button type="button" class="flex w-full items-center justify-between gap-3 text-left"
      :aria-expanded="open" @click="open = !open">
      <span class="font-bold">Acceso a cuenta de Castro Fallas</span>
      <span class="text-xs font-bold text-[var(--dh-text-muted)]">
        {{ grants.length }} usuarios autorizados · {{ open ? 'Ocultar' : 'Administrar' }}
      </span>
    </button>
    <div v-if="open" class="mt-4 space-y-4">
      <p class="text-xs text-[var(--dh-text-muted)]">
        El vendedor institucional no concede acceso automáticamente. Seleccione los usuarios
        que pueden consultar esta cuenta y sus contactos, análisis y crédito.
      </p>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <p v-if="notice" role="status" class="text-sm text-emerald-600">{{ notice }}</p>
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
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ user.displayName }} · {{ user.email }}
          </option>
        </select>
        <button type="submit" :disabled="!selectedUserId || saving"
          class="rounded-lg bg-[var(--dh-primary)] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          Autorizar acceso
        </button>
      </form>
      <p v-if="loading" class="text-xs text-[var(--dh-text-muted)]">Cargando autorizaciones…</p>
      <p v-else-if="!grants.length" class="text-xs text-[var(--dh-text-muted)]">
        No hay usuarios autorizados individualmente.
      </p>
      <ul v-else class="divide-y divide-[var(--dh-border)]">
        <li v-for="grant in grants" :key="grant.userId"
          class="flex flex-wrap items-center justify-between gap-2 py-2">
          <span class="min-w-0 break-all text-xs">
            {{ displayUsers.get(grant.userId) || grant.userId }}
          </span>
          <button type="button" :disabled="saving" @click="revoke(grant.userId)"
            class="rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs font-bold disabled:opacity-50">
            Revocar
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
