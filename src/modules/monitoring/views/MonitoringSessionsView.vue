<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Activity, AlertTriangle, MonitorCheck, RefreshCcw, ShieldCheck, Users } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { UsersService } from '@/core/services/usersService'
import { SessionsService } from '@/core/services/sessionsService'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { SessionDto } from '@/core/interfaces/sessions'
import type { UserDto } from '@/core/interfaces/users'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

interface UserSessionMonitorRow {
  userId: string
  userName: string
  displayName: string
  email: string
  activeSessions: number
  latestIpAddress: string | null
  latestUserAgent: string | null
  latestActivityAt: string | null
  status: 'online' | 'quiet'
}

const { t } = useI18n()
const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const rows = ref<UserSessionMonitorRow[]>([])
const lastLoadedAt = ref<Date | null>(null)

function isSuperUser(): boolean {
  return authStore.roles.some((role) => role.toLowerCase().includes('super'))
    || authStore.scopes.includes('*')
    || authStore.scopes.includes('auth.users.view')
}

const columns = computed<DhTableColumn<UserSessionMonitorRow>[]>(() => [
  { key: 'userName', label: t('monitoring.user') },
  { key: 'activeSessions', label: t('monitoring.activeSessions'), align: 'center' },
  { key: 'latestIpAddress', label: t('sessions.ipAddress') },
  { key: 'latestUserAgent', label: t('sessions.userAgent') },
  { key: 'latestActivityAt', label: t('monitoring.latestActivity') },
  { key: 'status', label: t('common.status'), align: 'center' },
])

const totalUsers = computed(() => rows.value.length)
const totalActiveSessions = computed(() => rows.value.reduce((total, row) => total + row.activeSessions, 0))
const onlineUsers = computed(() => rows.value.filter((row) => row.activeSessions > 0).length)
const quietUsers = computed(() => rows.value.filter((row) => row.activeSessions === 0).length)

const formattedLastLoadedAt = computed(() => {
  if (!lastLoadedAt.value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(lastLoadedAt.value)
})

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getLatestSession(sessions: SessionDto[]): SessionDto | null {
  if (sessions.length === 0) return null

  return [...sessions].sort((left, right) => {
    const leftDate = new Date(left.lastUsedAt || left.createdAt).getTime()
    const rightDate = new Date(right.lastUsedAt || right.createdAt).getTime()
    return rightDate - leftDate
  })[0] ?? null
}

function buildRow(user: UserDto, sessions: SessionDto[]): UserSessionMonitorRow {
  const latestSession = getLatestSession(sessions)

  return {
    userId: user.id,
    userName: user.userName,
    displayName: user.displayName,
    email: user.email,
    activeSessions: sessions.length,
    latestIpAddress: latestSession?.ipAddress ?? null,
    latestUserAgent: latestSession?.userAgent ?? null,
    latestActivityAt: latestSession?.lastUsedAt ?? latestSession?.createdAt ?? null,
    status: sessions.length > 0 ? 'online' : 'quiet',
  }
}

async function loadMonitoring() {
  if (!isSuperUser()) {
    rows.value = []
    return
  }

  try {
    loading.value = true

    const usersPage = await UsersService.browsePaged({ pageNumber: 1, pageSize: 100 })
    const users = usersPage.items

    const sessionResults = await Promise.all(
      users.map(async (user) => {
        try {
          const sessions = await SessionsService.getActiveByUser(user.id)
          return buildRow(user, sessions)
        } catch {
          return buildRow(user, [])
        }
      }),
    )

    rows.value = sessionResults.sort((left, right) => right.activeSessions - left.activeSessions)
    lastLoadedAt.value = new Date()
  } catch (error) {
    toastStore.backendError(error, t('monitoring.loadError'))
  } finally {
    loading.value = false
  }
}

useViewShortcuts({ save: loadMonitoring, refresh: loadMonitoring })

onMounted(loadMonitoring)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      :title="t('monitoring.sessionsTitle')"
      :subtitle="t('monitoring.sessionsSubtitle')"
      :icon="Activity"
    >
      <template #actions>
        <DhButton
          :icon="RefreshCcw"
          :label="t('common.refresh')"
          variant="secondary"
          @click="loadMonitoring"
        />
      </template>
    </DhPageHeader>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              {{ t('monitoring.totalUsers') }}
            </p>
            <h2 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ totalUsers }}</h2>
          </div>
          <div class="rounded-[22px] bg-red-500/10 p-3 text-[var(--dh-primary)]">
            <Users class="h-6 w-6" />
          </div>
        </div>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              {{ t('monitoring.activeSessions') }}
            </p>
            <h2 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ totalActiveSessions }}</h2>
          </div>
          <div class="rounded-[22px] bg-red-500/10 p-3 text-[var(--dh-primary)]">
            <MonitorCheck class="h-6 w-6" />
          </div>
        </div>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              {{ t('monitoring.onlineUsers') }}
            </p>
            <h2 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ onlineUsers }}</h2>
          </div>
          <div class="rounded-[22px] bg-emerald-500/10 p-3 text-emerald-500">
            <ShieldCheck class="h-6 w-6" />
          </div>
        </div>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              {{ t('monitoring.quietUsers') }}
            </p>
            <h2 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ quietUsers }}</h2>
          </div>
          <div class="rounded-[22px] bg-amber-500/10 p-3 text-amber-500">
            <AlertTriangle class="h-6 w-6" />
          </div>
        </div>
      </article>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('monitoring.liveSessions') }}</h2>
          <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ t('monitoring.lastUpdate') }}: {{ formattedLastLoadedAt }}
          </p>
        </div>
      </div>

      <DhDataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :empty-text="t('monitoring.empty')"
      >
        <template #cell-userName="{ row }">
          <div>
            <p class="font-black text-[var(--dh-text)]">{{ row.displayName || row.userName }}</p>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.email }}</p>
          </div>
        </template>

        <template #cell-activeSessions="{ value }">
          <div class="flex justify-center">
            <DhBadge :label="String(value)" :variant="Number(value) > 0 ? 'success' : 'neutral'" />
          </div>
        </template>

        <template #cell-latestUserAgent="{ value }">
          <span class="line-clamp-1 max-w-md">{{ value ?? '—' }}</span>
        </template>

        <template #cell-latestActivityAt="{ value }">
          {{ formatDate(String(value ?? '')) }}
        </template>

        <template #cell-status="{ value }">
          <div class="flex justify-center">
            <DhBadge
              :label="value === 'online' ? t('monitoring.online') : t('monitoring.quiet')"
              :variant="value === 'online' ? 'success' : 'neutral'"
            />
          </div>
        </template>
      </DhDataTable>
    </section>
  </section>
</template>
