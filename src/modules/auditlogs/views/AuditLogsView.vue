<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  Laptop2,
  RefreshCcw,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-vue-next'
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

interface AuditChange {
  fieldName: string
  oldValue: unknown
  newValue: unknown
}

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

const page = ref({ pageNumber: 1, pageSize: 20, total: 0 })
const totalPages = computed(() => Math.max(1, Math.ceil(page.value.total / page.value.pageSize)))
const actionOptions = computed(() => summary.value?.actions ?? [])
const serviceOptions = computed(() => summary.value?.sourceServices ?? [])
const selectedChanges = computed<AuditChange[]>(() => selected.value ? deriveChanges(selected.value) : [])

function cleanText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized || undefined
}

function cleanGuid(value: string): string | undefined {
  const normalized = value.trim().replace(/^["']+|["']+$/g, '')
  return normalized || undefined
}

function toUtcIso(value: string): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
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
    fromUtc: toUtcIso(filters.value.fromUtc),
    toUtc: toUtcIso(filters.value.toUtc),
  }
}

function formatDay(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value?: string | null): string {
  return `${formatDay(value)} · ${formatTime(value)}`
}

function actionLabel(action?: string | null): string {
  const normalized = (action || '').trim().toLowerCase()
  const labels: Record<string, string> = {
    created: 'Creó', updated: 'Modificó', deleted: 'Eliminó', viewed: 'Visualizó',
    approved: 'Aprobó', rejected: 'Rechazó', activated: 'Activó', inactivated: 'Inactivó',
    blocked: 'Bloqueó', unblocked: 'Desbloqueó', access_denied: 'Acceso denegado',
    permission_changed: 'Cambió permisos', session_revoked: 'Revocó sesión', login: 'Inició sesión',
    logout: 'Cerró sesión', exported: 'Exportó', analyzed: 'Analizó', chat: 'Usó IA', error: 'Error',
  }
  return labels[normalized] || humanize(normalized || 'evento')
}

function actionBadgeVariant(item: AuditEventListItemDto | AuditEventDto): 'danger' | 'neutral' {
  if (item.action === 'error' || item.action === 'access_denied') return 'danger'
  if ('hasError' in item && item.hasError) return 'danger'
  if ('errorMessage' in item && item.errorMessage) return 'danger'
  return 'neutral'
}

function humanize(value?: string | null): string {
  if (!value) return '—'
  return value
    .replace(/^Dhole\./i, '')
    .replace(/Service$/i, '')
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim()
}

function sourceLabel(source?: string | null): string {
  return source ? humanize(source) : 'Sistema'
}

function userById(userId?: string | null): UserDto | undefined {
  return userId ? users.value.find((user) => user.id === userId) : undefined
}

function actorName(item: AuditEventListItemDto | AuditEventDto): string {
  const user = userById(item.userId)
  return user?.displayName || item.userName || (item.userId ? 'Usuario identificado' : 'Sistema')
}

function actorSecondary(item: AuditEventListItemDto | AuditEventDto): string {
  const user = userById(item.userId)
  return user?.email || item.userId || 'Evento automático del sistema'
}

function targetName(item: AuditEventListItemDto | AuditEventDto): string {
  if (item.entityName) return item.entityName
  if (item.entityType === 'Screen' && item.requestPath) return humanize(item.requestPath.split('/').filter(Boolean).pop())
  if (item.entityType && item.entityId) return `${humanize(item.entityType)} · ${item.entityId}`
  if (item.entityType) return humanize(item.entityType)
  return 'Sistema'
}

function eventDescription(item: AuditEventListItemDto | AuditEventDto): string {
  return item.description || `${actorName(item)} ${actionLabel(item.action).toLowerCase()} ${targetName(item)}.`
}

function browserLabel(userAgent?: string | null): string {
  if (!userAgent) return 'No identificado'
  const ua = userAgent.toLowerCase()
  const browser = ua.includes('edg/') ? 'Microsoft Edge'
    : ua.includes('firefox/') ? 'Firefox'
      : ua.includes('chrome/') ? 'Chrome'
        : ua.includes('safari/') ? 'Safari'
          : 'Navegador'
  const os = ua.includes('windows') ? 'Windows'
    : ua.includes('android') ? 'Android'
      : ua.includes('iphone') || ua.includes('ipad') ? 'iOS'
        : ua.includes('mac os') || ua.includes('macintosh') ? 'macOS'
          : ua.includes('linux') ? 'Linux'
            : ''
  return os ? `${browser} · ${os}` : browser
}

function parseJson(value?: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) } catch { return value }
}

function parseJsonRecord(value?: string | null): Record<string, unknown> | null {
  const parsed = parseJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
}

function deriveChanges(event: AuditEventDto): AuditChange[] {
  const detailValue = parseJson(event.details)
  if (Array.isArray(detailValue)) {
    const details = detailValue
      .filter((item) => item && typeof item === 'object')
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        fieldName: String(item.fieldName ?? item.FieldName ?? 'Campo'),
        oldValue: item.oldValue ?? item.OldValue ?? null,
        newValue: item.newValue ?? item.NewValue ?? null,
      }))
    if (details.length) return details
  }

  const before = parseJsonRecord(event.beforeJson)
  const after = parseJsonRecord(event.afterJson)
  if (!before && !after) return []

  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  return [...keys]
    .filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
    .map((key) => ({ fieldName: key, oldValue: before?.[key], newValue: after?.[key] }))
}

function isSensitive(fieldName: string): boolean {
  return /(password|passwd|token|secret|api.?key|authorization|refresh|access.?token|hash|credential)/i.test(fieldName)
}

function displayValue(fieldName: string, value: unknown): string {
  if (isSensitive(fieldName)) return '•••••• Protegido'
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'object') {
    try { return JSON.stringify(value, null, 2) } catch { return String(value) }
  }
  return String(value)
}

function prettyJson(value?: string | null): string {
  if (!value) return '—'
  try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
}

async function loadUsers() {
  try {
    usersLoading.value = true
    const response = await UsersService.browsePaged({
      pageNumber: 1,
      pageSize: 100,
      search: cleanText(userSearch.value),
      isActive: null,
      isLocked: null,
    })
    users.value = response.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los usuarios para identificar los eventos.')
  } finally {
    usersLoading.value = false
  }
}

async function loadSummary() {
  try {
    summaryLoading.value = true
    summary.value = await AuditLogsService.getSummary(toQuery())
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el resumen de auditoría.')
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
    toastStore.backendError(error, 'No se pudo cargar la auditoría.')
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
    toastStore.backendError(error, 'No se pudo abrir el detalle del evento.')
  } finally {
    detailLoading.value = false
  }
}

async function search() {
  page.value.pageNumber = 1
  await loadAll()
}

async function clearFilters() {
  filters.value = {
    sourceService: '', entityType: '', entityId: '', userId: '', correlationId: '',
    action: '', eventType: '', fromUtc: '', toUtc: '',
  }
  userSearch.value = ''
  page.value.pageNumber = 1
  await Promise.all([loadUsers(), loadAll()])
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

async function reloadAuditLogsView() {
  await Promise.all([loadUsers(), loadAll()])
}

useViewShortcuts({ save: reloadAuditLogsView, refresh: reloadAuditLogsView })
onMounted(reloadAuditLogsView)
</script>

<template>
  <section class="space-y-5">
    <header class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="rounded-3xl bg-[var(--dh-primary-soft)] p-3 text-[var(--dh-primary)]">
            <ShieldAlert class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-[var(--dh-text)]">Auditoría del sistema</h1>
            <p class="mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]">
              Consulte quién vio, creó, modificó, aprobó o eliminó información, cuándo ocurrió, desde qué IP y qué cambió exactamente.
            </p>
          </div>
        </div>
        <DhButton :icon="RefreshCcw" label="Actualizar" :loading="loading || summaryLoading" @click="loadAll" />
      </div>
    </header>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Eventos</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ summary?.totalEvents ?? 0 }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Usuarios</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ summary?.totalUsers ?? 0 }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Objetos auditados</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ summary?.totalEntities ?? 0 }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Accesos denegados</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ summary?.totalAccessDenied ?? 0 }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Errores</p>
        <p class="mt-2 text-2xl font-black text-red-500">{{ summary?.totalErrors ?? 0 }}</p>
      </article>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Buscar en la auditoría</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Use solo los filtros que necesite.</p>
        </div>
        <div class="flex gap-2">
          <DhButton label="Limpiar" variant="secondary" @click="clearFilters" />
          <DhButton :icon="Search" label="Buscar" :loading="loading" @click="search" />
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-1">
          <span class="text-xs font-black text-[var(--dh-text-muted)]">Acción</span>
          <select v-model="filters.action" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none">
            <option value="">Todas</option>
            <option v-for="option in actionOptions" :key="option.action" :value="option.action">{{ actionLabel(option.action) }} ({{ option.total }})</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs font-black text-[var(--dh-text-muted)]">Servicio</span>
          <select v-model="filters.sourceService" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none">
            <option value="">Todos</option>
            <option v-for="option in serviceOptions" :key="option.sourceService" :value="option.sourceService">{{ sourceLabel(option.sourceService) }} ({{ option.total }})</option>
          </select>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-xs font-black text-[var(--dh-text-muted)]">Usuario</span>
          <div class="flex gap-2">
            <select v-model="filters.userId" class="h-11 min-w-0 flex-1 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none">
              <option value="">Todos los usuarios</option>
              <option v-for="user in users" :key="user.id" :value="user.id">{{ user.displayName }} — {{ user.email }}</option>
            </select>
            <DhInput v-model="userSearch" class="min-w-0 flex-1" :label="''" placeholder="Buscar usuario" @keyup.enter="loadUsers" />
            <DhButton :icon="Search" label="" variant="secondary" :loading="usersLoading" @click="loadUsers" />
          </div>
        </label>

        <DhInput v-model="filters.entityType" label="Tipo de objeto" placeholder="Ej. RateHeader, User, Screen" />
        <DhInput v-model="filters.entityId" label="ID del objeto" placeholder="GUID si lo conoce" />
        <label class="space-y-1">
          <span class="text-xs font-black text-[var(--dh-text-muted)]">Desde</span>
          <input v-model="filters.fromUtc" type="datetime-local" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none" />
        </label>
        <label class="space-y-1">
          <span class="text-xs font-black text-[var(--dh-text-muted)]">Hasta</span>
          <input v-model="filters.toUtc" type="datetime-local" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none" />
        </label>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">Actividad registrada</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ page.total }} eventos · Página {{ page.pageNumber }} de {{ totalPages }}</p>
        </div>
      </div>

      <div v-if="loading" class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)]">Cargando auditoría…</div>
      <div v-else-if="items.length === 0" class="rounded-[24px] border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)]">No hay eventos para los filtros seleccionados.</div>

      <article
        v-for="item in items"
        v-else
        :key="item.id"
        class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 transition hover:border-[var(--dh-primary)]"
      >
        <div class="grid gap-4 xl:grid-cols-[170px_minmax(0,1fr)_260px_150px] xl:items-center">
          <div>
            <div class="flex items-center gap-2 text-sm font-black text-[var(--dh-text)]"><CalendarDays class="h-4 w-4 text-[var(--dh-primary)]" />{{ formatDay(item.occurredAt) }}</div>
            <div class="mt-1 flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]"><Clock3 class="h-4 w-4" />{{ formatTime(item.occurredAt) }}</div>
          </div>

          <div class="min-w-0">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <DhBadge :label="actionLabel(item.action)" :variant="actionBadgeVariant(item)" />
              <span class="text-xs font-black text-[var(--dh-primary)]">{{ sourceLabel(item.sourceService) }}</span>
            </div>
            <p class="text-base font-black leading-6 text-[var(--dh-text)]">{{ eventDescription(item) }}</p>
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              <span>Sobre: <strong class="text-[var(--dh-text)]">{{ targetName(item) }}</strong></span>
              <span v-if="item.requestPath">Ruta: <strong class="text-[var(--dh-text)]">{{ item.requestPath }}</strong></span>
            </div>
          </div>

          <div class="grid gap-2 text-xs">
            <div class="flex min-w-0 items-center gap-2"><UserRound class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><div class="min-w-0"><p class="truncate font-black text-[var(--dh-text)]">{{ actorName(item) }}</p><p class="truncate font-semibold text-[var(--dh-text-muted)]">{{ actorSecondary(item) }}</p></div></div>
            <div class="flex items-center gap-2"><Globe2 class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><span class="font-bold text-[var(--dh-text)]">IP {{ item.ipAddress || 'no disponible' }}</span></div>
            <div class="flex items-center gap-2"><Laptop2 class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><span class="font-semibold text-[var(--dh-text-muted)]">{{ browserLabel(item.userAgent) }}</span></div>
          </div>

          <div class="flex justify-end">
            <DhButton :icon="Eye" label="Ver detalle" variant="secondary" :loading="detailLoading" @click="openDetail(item)" />
          </div>
        </div>
      </article>

      <div class="flex items-center justify-between rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
        <DhButton :icon="ChevronLeft" label="Anterior" variant="secondary" :disabled="page.pageNumber <= 1" @click="previousPage" />
        <span class="text-xs font-black text-[var(--dh-text-muted)]">Página {{ page.pageNumber }} / {{ totalPages }}</span>
        <DhButton :icon="ChevronRight" label="Siguiente" variant="secondary" :disabled="page.pageNumber >= totalPages" @click="nextPage" />
      </div>
    </section>

    <div v-if="selected" class="fixed inset-0 z-[120] flex justify-end bg-black/40" @click.self="selected = null">
      <aside class="h-full w-full max-w-3xl overflow-y-auto border-l border-[var(--dh-border)] bg-[var(--dh-bg)] p-5 shadow-2xl">
        <div class="sticky top-0 z-10 mb-5 flex items-start justify-between gap-4 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div>
            <div class="flex flex-wrap items-center gap-2"><DhBadge :label="actionLabel(selected.action)" :variant="actionBadgeVariant(selected)" /><span class="text-xs font-black text-[var(--dh-primary)]">{{ sourceLabel(selected.sourceService) }}</span></div>
            <h2 class="mt-3 text-xl font-black text-[var(--dh-text)]">{{ eventDescription(selected) }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ formatDateTime(selected.occurredAt) }}</p>
          </div>
          <button type="button" class="rounded-xl border border-[var(--dh-border)] p-2 text-[var(--dh-text)]" @click="selected = null"><X class="h-5 w-5" /></button>
        </div>

        <section class="grid gap-3 sm:grid-cols-2">
          <article class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-xs font-black uppercase text-[var(--dh-text-muted)]">Quién</p><p class="mt-2 font-black text-[var(--dh-text)]">{{ actorName(selected) }}</p><p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ actorSecondary(selected) }}</p></article>
          <article class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-xs font-black uppercase text-[var(--dh-text-muted)]">Dónde</p><p class="mt-2 font-black text-[var(--dh-text)]">IP {{ selected.ipAddress || 'no disponible' }}</p><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ browserLabel(selected.userAgent) }}</p></article>
          <article class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-xs font-black uppercase text-[var(--dh-text-muted)]">Sobre qué</p><p class="mt-2 font-black text-[var(--dh-text)]">{{ targetName(selected) }}</p><p class="mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ selected.entityId || selected.requestPath || 'Sin identificador adicional' }}</p></article>
          <article class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-xs font-black uppercase text-[var(--dh-text-muted)]">Cuándo</p><p class="mt-2 font-black text-[var(--dh-text)]">{{ formatDay(selected.occurredAt) }}</p><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ formatTime(selected.occurredAt) }}</p></article>
        </section>

        <section class="mt-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="mb-4"><h3 class="text-lg font-black text-[var(--dh-text)]">Cambios realizados</h3><p class="text-xs font-semibold text-[var(--dh-text-muted)]">Comparación legible de los valores antes y después.</p></div>
          <div v-if="selectedChanges.length === 0" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-5 text-sm font-semibold text-[var(--dh-text-muted)]">Este evento no registró cambios de campos. Esto es normal para visualizaciones, inicio de sesión y otras acciones sin modificación.</div>
          <div v-else class="overflow-hidden rounded-2xl border border-[var(--dh-border)]">
            <table class="w-full text-left text-sm">
              <thead class="bg-[var(--dh-input)] text-xs font-black uppercase text-[var(--dh-text-muted)]"><tr><th class="px-4 py-3">Campo</th><th class="px-4 py-3">Antes</th><th class="px-4 py-3">Después</th></tr></thead>
              <tbody>
                <tr v-for="change in selectedChanges" :key="change.fieldName" class="border-t border-[var(--dh-border)] align-top">
                  <td class="px-4 py-3 font-black text-[var(--dh-text)]">{{ humanize(change.fieldName) }}</td>
                  <td class="max-w-[240px] whitespace-pre-wrap break-words px-4 py-3 font-semibold text-[var(--dh-text-muted)]">{{ displayValue(change.fieldName, change.oldValue) }}</td>
                  <td class="max-w-[240px] whitespace-pre-wrap break-words px-4 py-3 font-bold text-[var(--dh-text)]">{{ displayValue(change.fieldName, change.newValue) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section v-if="selected.errorMessage" class="mt-5 rounded-[24px] border border-red-500/30 bg-red-500/5 p-5"><h3 class="font-black text-red-500">Error registrado</h3><p class="mt-2 whitespace-pre-wrap text-sm font-semibold text-[var(--dh-text)]">{{ selected.errorMessage }}</p></section>

        <details class="mt-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <summary class="cursor-pointer text-sm font-black text-[var(--dh-text)]">Información técnica y trazabilidad</summary>
          <div class="mt-4 grid gap-3 text-xs">
            <div class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Event ID</span><code class="break-all rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ selected.eventId }}</code></div>
            <div class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Correlation ID</span><code class="break-all rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ selected.correlationId }}</code></div>
            <div class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Tipo de evento</span><code class="break-all rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ selected.eventType || '—' }}</code></div>
            <div class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Método / ruta</span><code class="break-all rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ selected.httpMethod || '—' }} {{ selected.requestPath || '' }}</code></div>
            <div class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">User-Agent</span><code class="break-all rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ selected.userAgent || '—' }}</code></div>
            <div v-if="selected.metadata" class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Metadata</span><pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ prettyJson(selected.metadata) }}</pre></div>
            <div v-if="selected.payloadJson" class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Payload</span><pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--dh-input)] p-3 text-[var(--dh-text)]">{{ prettyJson(selected.payloadJson) }}</pre></div>
            <div v-if="selected.stackTrace" class="grid gap-1"><span class="font-black text-[var(--dh-text-muted)]">Stack trace</span><pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--dh-input)] p-3 text-red-400">{{ selected.stackTrace }}</pre></div>
          </div>
        </details>
      </aside>
    </div>
  </section>
</template>
