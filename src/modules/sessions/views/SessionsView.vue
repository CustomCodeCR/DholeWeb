<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Ban, Clock3, MonitorCheck, RefreshCcw, ShieldAlert } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { SessionsService } from '@/core/services/sessionsService'
import { AuthService } from '@/core/services/authService'
import { UsersService } from '@/core/services/usersService'
import type { SessionDto } from '@/core/interfaces/sessions'
import type { UserDto } from '@/core/interfaces/users'
import AuthReasonModal from '@/modules/auth/components/AuthReasonModal.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()

const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const sessions = ref<SessionDto[]>([])
const users = ref<UserDto[]>([])
const selectedUserId = ref(authStore.userId ?? '')
const activeOnly = ref(false)

const canBrowseUsers = computed(() => authStore.hasScope(AUTH_SCOPES.users.view))
const canRevoke = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revoke))
const canRevokeAll = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revokeAll))
const showRowActions = computed(() => canRevoke.value)

const activeSessionCount = computed(() => sessions.value.filter((session) => !session.isRevoked).length)
const revokedSessionCount = computed(() => sessions.value.filter((session) => session.isRevoked).length)
const expiringSoonCount = computed(() => {
  const limit = Date.now() + 60 * 60 * 1000

  return sessions.value.filter((session) => {
    if (session.isRevoked || !session.expiresAt) return false
    const expiresAt = new Date(session.expiresAt).getTime()
    return !Number.isNaN(expiresAt) && expiresAt <= limit
  }).length
})

const columns = computed<DhTableColumn<SessionDto>[]>(() => {
  const base: DhTableColumn<SessionDto>[] = [
    { key: 'ipAddress', label: t('sessions.ipAddress') },
    { key: 'userAgent', label: t('sessions.userAgent') },
    { key: 'createdAt', label: t('sessions.createdAt') },
    { key: 'expiresAt', label: t('sessions.expiresAt') },
    { key: 'isRevoked', label: t('sessions.revoked'), align: 'center' },
  ]

  if (showRowActions.value) {
    base.push({ key: 'actions', label: '', align: 'right' })
  }

  return base
})

const userOptions = computed(() => [
  ...(authStore.userId ? [{ label: 'Mi usuario actual', value: authStore.userId }] : []),
  ...users.value.map((user) => ({ label: `${user.displayName || user.userName} · ${user.email}`, value: user.id })),
])

const filteredSessions = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter((x) => `${x.ipAddress ?? ''} ${x.userAgent ?? ''} ${x.id}`.toLowerCase().includes(q))
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

async function loadUsers() {
  if (!canBrowseUsers.value) {
    users.value = []
    return
  }

  try {
    const result = await UsersService.browsePaged({ pageNumber: 1, pageSize: 100 })
    users.value = result.items.filter((user) => user.id !== authStore.userId)
    if (!selectedUserId.value && result.items[0]) selectedUserId.value = result.items[0].id
  } catch (error) {
    users.value = []
    toastStore.backendWarning(error, 'No se pudieron cargar usuarios para revisar sesiones.')
  }
}

async function loadSessions() {
  if (!selectedUserId.value) {
    sessions.value = []
    total.value = 0
    return
  }

  try {
    loading.value = true
    if (activeOnly.value) {
      const result = await SessionsService.getActiveByUser(selectedUserId.value)
      sessions.value = result
      total.value = result.length
      return
    }

    const result = await SessionsService.getByUserPaged(selectedUserId.value, { pageNumber: page.value, pageSize: pageSize.value })
    sessions.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las sesiones.')
  } finally {
    loading.value = false
  }
}

function openRevoke(session: SessionDto) {
  if (!canRevoke.value || session.isRevoked) return

  modalStore.open({
    title: t('sessions.revoke'),
    component: AuthReasonModal,
    size: 'md',
    props: {
      title: t('sessions.revoke'),
      message: session.id,
      confirmLabel: t('common.revoke'),
      danger: true,
      onConfirm: async (reason: string | null) => {
        await SessionsService.revoke(session.id, { revokedBy: authStore.userId, reason })
        toastStore.success('Sesión revocada')
        await loadSessions()
      },
    },
  })
}

function openRevokeAll() {
  if (!canRevokeAll.value || !selectedUserId.value) return

  modalStore.open({
    title: t('common.revokeAll'),
    component: AuthReasonModal,
    size: 'md',
    props: {
      title: 'Revocar sesiones del usuario',
      message: 'Esto revoca todas las sesiones activas del usuario seleccionado.',
      confirmLabel: t('common.revokeAll'),
      danger: true,
      onConfirm: async (reason: string | null) => {
        await SessionsService.revokeByUser(selectedUserId.value, { revokedBy: authStore.userId, reason })
        toastStore.success('Sesiones revocadas')
        await loadSessions()
      },
    },
  })
}

async function refreshToken() {
  if (!authStore.refreshToken) {
    toastStore.error('Error', 'No hay refresh token activo.')
    return
  }

  try {
    const response = await AuthService.refreshToken({ refreshToken: authStore.refreshToken })
    authStore.setSession(response)
    toastStore.success('Token refrescado')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo refrescar el token.')
  }
}

watch([selectedUserId, activeOnly, page, pageSize], loadSessions)

onMounted(async () => {
  await loadUsers()
  await loadSessions()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('sessions.title')" :subtitle="t('sessions.subtitle')" :icon="MonitorCheck">
      <template #actions>
        <DhButton :icon="RefreshCcw" :label="t('common.refreshSession')" variant="secondary" @click="refreshToken" />
        <DhButton v-if="canRevokeAll" :icon="Ban" :label="t('common.revokeAll')" variant="danger" @click="openRevokeAll" />
      </template>
    </DhPageHeader>


    <div class="grid gap-4 md:grid-cols-3">
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.active') }}</p>
          <MonitorCheck class="h-5 w-5 text-green-500" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ activeSessionCount }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.activeHint') }}</p>
      </article>

      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.revoked') }}</p>
          <ShieldAlert class="h-5 w-5 text-red-500" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ revokedSessionCount }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.revokedHint') }}</p>
      </article>

      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.expiringSoon') }}</p>
          <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ expiringSoonCount }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('sessions.monitoring.expiringSoonHint') }}</p>
      </article>
    </div>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <DhSelect v-model="selectedUserId" label="Usuario" :options="userOptions" :disabled="!canBrowseUsers" />
        <label class="flex items-end gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-bold">
          <input v-model="activeOnly" type="checkbox" class="accent-[var(--dh-primary)]" />
          {{ t('sessions.activeOnly') }}
        </label>
      </div>

      <DhCrudToolbar v-model:search="search" :title="t('sessions.title')" :show-create="false" @refresh="loadSessions" @filter="loadSessions" @search="loadSessions" />

      <div class="mt-5">
        <DhDataTable :columns="columns" :rows="filteredSessions" :loading="loading" :empty-text="t('sessions.empty')">
          <template #cell-userAgent="{ value }"><span class="line-clamp-1 max-w-md">{{ value ?? '—' }}</span></template>
          <template #cell-createdAt="{ value }">{{ formatDate(String(value)) }}</template>
          <template #cell-expiresAt="{ value }">{{ formatDate(String(value)) }}</template>
          <template #cell-isRevoked="{ value }"><div class="flex justify-center"><DhBadge :label="value ? t('common.yes') : t('common.no')" :variant="value ? 'danger' : 'success'" /></div></template>
          <template v-if="showRowActions" #cell-actions="{ row }">
            <div class="flex justify-end">
              <button v-if="canRevoke && !row.isRevoked" class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10" title="Revocar" @click.stop="openRevoke(row)"><Ban class="h-4 w-4" /></button>
            </div>
          </template>
        </DhDataTable>
      </div>

      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></div>
    </section>
  </section>
</template>
