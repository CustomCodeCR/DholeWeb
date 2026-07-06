<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Eye, RefreshCcw, Search, ShieldAlert, Users } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { useToastStore } from '@/core/stores/toastStore'
import { AuditLogsService } from '@/core/services/auditLogsService'
import { UsersService } from '@/core/services/usersService'
import type {
  AuditEventDto,
  AuditEventListItemDto,
  AuditEventSummaryDto,
  BrowseAuditEventsQuery,
} from '@/core/interfaces/auditLogs'
import type { UserDto } from '@/core/interfaces/users'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()
const toastStore = useToastStore()

const loading = ref(false)
const detailLoading = ref(false)
const summaryLoading = ref(false)
const usersLoading = ref(false)

const items = ref<AuditEventListItemDto[]>([])
const selected = ref<AuditEventDto | null>(null)
const summary = ref<AuditEventSummaryDto | null>(null)
const users = ref<UserDto[]>([])

const userSearch = ref('')

const filters = ref({
  sourceService: '',
  entityType: '',
  entityId: '',
  userId: '',
  correlationId: '',
  action: '',
  eventType: '',
  fromUtc: '',
  toUtc: '',
})

const page = ref({
  pageNumber: 1,
  pageSize: 20,
  total: 0,
})

const totalPages = computed(() => {
  if (page.value.total <= 0) return 1
  return Math.ceil(page.value.total / page.value.pageSize)
})

function cleanText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized || undefined
}

function cleanGuid(value: string): string | undefined {
  const normalized = value.trim().replace(/^["']+|["']+$/g, '')
  return normalized || undefined
}

function toQuery(): BrowseAuditEventsQuery {
  return {
    pageNumber: page.value.pageNumber,
    pageSize: page.value.pageSize,
    sourceService: cleanText(filters.value.sourceService),
    entityType: cleanText(filters.value.entityType),
    entityId: cleanGuid(filters.value.entityId),
    userId: cleanGuid(filters.value.userId),
    correlationId: cleanGuid(filters.value.correlationId),
    action: cleanText(filters.value.action),
    eventType: cleanText(filters.value.eventType),
    fromUtc: cleanText(filters.value.fromUtc),
    toUtc: cleanText(filters.value.toUtc),
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function prettyJson(value?: string | null): string {
  if (!value) return '—'

  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

async function loadUsers() {
  try {
    usersLoading.value = true

    const response = await UsersService.browsePaged({
      pageNumber: 1,
      pageSize: 50,
      search: cleanText(userSearch.value),
      isActive: null,
      isLocked: null,
    })

    users.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los usuarios.')
  } finally {
    usersLoading.value = false
  }
}

async function loadSummary() {
  try {
    summaryLoading.value = true
    summary.value = await AuditLogsService.getSummary(toQuery())
  } catch (error) {
    toastStore.backendError(error, t('audits.summaryLoadError'))
  } finally {
    summaryLoading.value = false
  }
}

async function loadEvents() {
  try {
    loading.value = true

    const response = await AuditLogsService.browsePaged(toQuery())

    items.value = response.items
    page.value.total = response.totalCount ?? response.items.length
  } catch (error) {
    toastStore.backendError(error, t('audits.loadError'))
  } finally {
    loading.value = false
  }
}

async function loadAll() {
  await Promise.all([loadEvents(), loadSummary()])
}

async function openDetail(item: AuditEventListItemDto) {
  try {
    detailLoading.value = true
    selected.value = await AuditLogsService.getById(item.id)
  } catch (error) {
    toastStore.backendError(error, t('audits.detailLoadError'))
  } finally {
    detailLoading.value = false
  }
}

async function search() {
  page.value.pageNumber = 1
  await loadAll()
}

async function searchUsers() {
  await loadUsers()
}

async function nextPage() {
  if (page.value.pageNumber >= totalPages.value) return

  page.value.pageNumber += 1
  await loadEvents()
}

async function previousPage() {
  if (page.value.pageNumber <= 1) return

  page.value.pageNumber -= 1
  await loadEvents()
}

async function clearFilters() {
  filters.value = {
    sourceService: '',
    entityType: '',
    entityId: '',
    userId: '',
    correlationId: '',
    action: '',
    eventType: '',
    fromUtc: '',
    toUtc: '',
  }

  userSearch.value = ''
  page.value.pageNumber = 1

  await Promise.all([loadUsers(), loadAll()])
}

async function reloadAuditLogsView() {
  await Promise.all([loadUsers(), loadAll()])
}

useViewShortcuts({ save: reloadAuditLogsView, refresh: reloadAuditLogsView })

onMounted(reloadAuditLogsView)
</script>

<template>
  <section class="space-y-5">
    <header class="rounded-[32px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <div class="rounded-3xl bg-[var(--dh-primary-soft)] p-3 text-[var(--dh-primary)]">
              <ShieldAlert class="h-6 w-6" />
            </div>

            <div>
              <h1 class="text-2xl font-black text-[var(--dh-text)]">
                {{ t('audits.title') }}
              </h1>

              <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
                {{ t('audits.subtitle') }}
              </p>
            </div>
          </div>
        </div>

        <DhButton
          :icon="RefreshCcw"
          :label="t('common.refresh')"
          :loading="loading || summaryLoading"
          @click="loadAll"
        />
      </div>
    </header>

    <section class="grid gap-3 md:grid-cols-5">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          {{ t('audits.totalEvents') }}
        </p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">
          {{ summary?.totalEvents ?? 0 }}
        </p>
      </div>

      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          {{ t('audits.totalErrors') }}
        </p>
        <p class="mt-2 text-2xl font-black text-red-500">
          {{ summary?.totalErrors ?? 0 }}
        </p>
      </div>

      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          {{ t('audits.totalAccessDenied') }}
        </p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">
          {{ summary?.totalAccessDenied ?? 0 }}
        </p>
      </div>

      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          {{ t('audits.totalUsers') }}
        </p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">
          {{ summary?.totalUsers ?? 0 }}
        </p>
      </div>

      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          {{ t('audits.totalEntities') }}
        </p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">
          {{ summary?.totalEntities ?? 0 }}
        </p>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">
            {{ t('common.filters') }}
          </h2>
        </div>

        <div class="flex gap-2">
          <DhButton :label="t('audits.clearFilters')" variant="secondary" @click="clearFilters" />

          <DhButton :icon="Search" :label="t('common.search')" :loading="loading" @click="search" />
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <DhInput v-model="filters.sourceService" :label="t('audits.sourceService')" />
        <DhInput v-model="filters.entityType" :label="t('audits.entityType')" />
        <DhInput v-model="filters.entityId" :label="t('audits.entityId')" />
        <DhInput v-model="filters.correlationId" :label="t('audits.correlationId')" />
        <DhInput v-model="filters.action" :label="t('audits.action')" />
        <DhInput v-model="filters.eventType" :label="t('audits.eventType')" />

        <div class="md:col-span-2 space-y-2">
          <label class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
            {{ t('audits.user') }}
          </label>

          <div class="flex gap-2">
            <div class="relative flex-1">
              <Users
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]"
              />

              <select
                v-model="filters.userId"
                class="h-11 w-full appearance-none rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] pl-10 pr-4 text-sm font-bold text-[var(--dh-text)] outline-none transition focus:border-[var(--dh-primary)]"
              >
                <option value="">
                  {{ t('common.all') }}
                </option>

                <option v-for="user in users" :key="user.id" :value="user.id">
                  {{ user.displayName }} — {{ user.email }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex gap-2">
            <DhInput
              v-model="userSearch"
              class="flex-1"
              :label="''"
              placeholder="Buscar usuario por nombre o correo"
              @keyup.enter="searchUsers"
            />

            <DhButton
              :icon="Search"
              :label="usersLoading ? t('common.loading') : t('common.search')"
              variant="secondary"
              :loading="usersLoading"
              @click="searchUsers"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">
            {{ t('audits.events') }}
          </h2>

          <p class="text-xs font-bold text-[var(--dh-text-muted)]">
            {{ page.total }} {{ t('audits.events').toLowerCase() }}
          </p>
        </div>
      </div>

      <div
        v-if="loading"
        class="rounded-[24px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="items.length === 0"
        class="rounded-[24px] border border-dashed border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]"
      >
        {{ t('audits.empty') }}
      </div>

      <div v-else class="overflow-hidden rounded-[24px] border border-[var(--dh-border)]">
        <table class="w-full text-left text-sm">
          <thead
            class="bg-[var(--dh-input)] text-xs uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
          >
            <tr>
              <th class="px-4 py-3">{{ t('audits.occurredAt') }}</th>
              <th class="px-4 py-3">{{ t('audits.sourceService') }}</th>
              <th class="px-4 py-3">{{ t('audits.action') }}</th>
              <th class="px-4 py-3">{{ t('audits.entityType') }}</th>
              <th class="px-4 py-3">{{ t('audits.user') }}</th>
              <th class="px-4 py-3">{{ t('common.status') }}</th>
              <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              class="border-t border-[var(--dh-border)] text-[var(--dh-text)]"
            >
              <td class="px-4 py-3 font-bold">
                {{ formatDate(item.occurredAt) }}
              </td>

              <td class="px-4 py-3">
                <p class="font-black">{{ item.sourceService }}</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ item.eventType || '—' }}
                </p>
              </td>

              <td class="px-4 py-3">
                <DhBadge :label="item.action" :variant="item.hasError ? 'danger' : 'neutral'" />
              </td>

              <td class="px-4 py-3">
                <p class="font-bold">{{ item.entityType || '—' }}</p>
                <p class="max-w-[180px] truncate text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ item.entityId || '—' }}
                </p>
              </td>

              <td class="px-4 py-3">
                <p class="font-bold">{{ item.userName || '—' }}</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ item.ipAddress || '—' }}
                </p>
              </td>

              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <DhBadge
                    v-if="item.hasPayloadJson"
                    :label="t('audits.hasPayload')"
                    variant="primary"
                  />
                  <DhBadge v-if="item.hasError" :label="t('audits.hasError')" variant="danger" />
                  <DhBadge v-if="item.hasDetails" :label="t('common.details')" variant="neutral" />
                </div>
              </td>

              <td class="px-4 py-3 text-right">
                <button
                  class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                  :title="t('audits.viewDetail')"
                  @click="openDetail(item)"
                >
                  <Eye class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <DhButton
          :label="t('common.previous')"
          variant="secondary"
          :disabled="page.pageNumber <= 1"
          @click="previousPage"
        />

        <p class="text-sm font-black text-[var(--dh-text-muted)]">
          {{ page.pageNumber }} / {{ totalPages }}
        </p>

        <DhButton
          :label="t('common.next')"
          variant="secondary"
          :disabled="page.pageNumber >= totalPages"
          @click="nextPage"
        />
      </div>
    </section>

    <section
      v-if="selected"
      class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
    >
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">
            {{ t('common.details') }}
          </h2>

          <p class="text-xs font-bold text-[var(--dh-text-muted)]">
            {{ selected.eventId }}
          </p>
        </div>

        <DhButton
          :label="t('common.close')"
          variant="secondary"
          :loading="detailLoading"
          @click="selected = null"
        />
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">
            {{ t('audits.sourceService') }}
          </p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.sourceService }}
          </p>
        </div>

        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('audits.action') }}</p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.action }}
          </p>
        </div>

        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('audits.eventType') }}</p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.eventType || '—' }}
          </p>
        </div>

        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('audits.entityType') }}</p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.entityType || '—' }}
          </p>
        </div>

        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('audits.entityId') }}</p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.entityId || '—' }}
          </p>
        </div>

        <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
          <p class="text-xs font-black text-[var(--dh-text-muted)]">{{ t('audits.userName') }}</p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ selected.userName || '—' }}
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="mb-2 text-sm font-black text-[var(--dh-text)]">{{ t('audits.before') }}</p>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--dh-text-muted)]"
            >{{ prettyJson(selected.beforeJson) }}</pre
          >
        </div>

        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="mb-2 text-sm font-black text-[var(--dh-text)]">{{ t('audits.after') }}</p>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--dh-text-muted)]"
            >{{ prettyJson(selected.afterJson) }}</pre
          >
        </div>

        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="mb-2 text-sm font-black text-[var(--dh-text)]">{{ t('audits.payload') }}</p>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--dh-text-muted)]"
            >{{ prettyJson(selected.payloadJson) }}</pre
          >
        </div>

        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="mb-2 text-sm font-black text-[var(--dh-text)]">{{ t('audits.metadata') }}</p>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--dh-text-muted)]"
            >{{ prettyJson(selected.metadata) }}</pre
          >
        </div>

        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="mb-2 text-sm font-black text-[var(--dh-text)]">{{ t('audits.detailsJson') }}</p>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--dh-text-muted)]"
            >{{ prettyJson(selected.details) }}</pre
          >
        </div>

        <div
          v-if="selected.errorMessage || selected.stackTrace"
          class="rounded-[24px] border border-red-500/30 bg-red-500/10 p-4"
        >
          <p class="mb-2 text-sm font-black text-red-500">{{ t('audits.errorMessage') }}</p>
          <pre class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-red-400">{{
            selected.errorMessage || '—'
          }}</pre>

          <p class="mb-2 mt-4 text-sm font-black text-red-500">{{ t('audits.stackTrace') }}</p>
          <pre class="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-red-400">{{
            selected.stackTrace || '—'
          }}</pre>
        </div>
      </div>
    </section>
  </section>
</template>
