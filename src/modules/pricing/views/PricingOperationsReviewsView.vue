<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, RefreshCw, ClipboardCheck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { fetchClient } from '@/core/api/fetchConfig'
import { useAuthStore } from '@/core/stores/authStore'

interface PricingOperationsReview {
  id: string
  operationsRequestId: string
  caseId: string
  idtra: string
  quoteId: string | null
  acceptedOptionId: string | null
  serviceCode: string
  reason: string
  status: string
  requestedAtUtc: string
  decidedAtUtc: string | null
  decisionReason: string | null
  version: number
}
interface PagedReview { items: PricingOperationsReview[]; total: number; page: number; pageSize: number }

const router = useRouter()
const auth = useAuthStore()
const canReview = computed(() =>
  auth.hasScope('pricing.rate.update') ||
  auth.hasScope('pricing.rate.approve-low-margin') ||
  auth.hasRole('SuperUsuario') || auth.hasRole('SuperAdmin'))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const page = ref(1)
const pageSize = 25
const total = ref(0)
const rows = ref<PricingOperationsReview[]>([])
const selected = ref<PricingOperationsReview | null>(null)
const decision = ref('NO_PRICE_CHANGE_REQUIRED')
const reason = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const canSubmit = computed(() => canReview.value && selected.value &&
  reason.value.trim().length >= 10 && reason.value.trim().length <= 2000 && !saving.value)
const columns: DhTableColumn<PricingOperationsReview>[] = [
  { key: 'idtra', label: 'Trámite' },
  { key: 'serviceCode', label: 'Tipo de revisión' },
  { key: 'reason', label: 'Motivo Operations' },
  { key: 'status', label: 'Estado' },
  { key: 'requestedAtUtc', label: 'Solicitado' },
  { key: 'actions', label: '', align: 'right' },
]
const decisions = [
  { value: 'NO_PRICE_CHANGE_REQUIRED', label: 'Conciliado, sin cambio de precio' },
  { value: 'REVISION_REQUIRED', label: 'Requiere revisión o modificación comercial' },
  { value: 'REJECTED', label: 'Rechazar solicitud' },
]
function reviewType(code: string) {
  return code === 'QUOTE_DISCREPANCY' ? 'Modificación por diferencias QUO / trámite' : 'Servicio adicional'
}
function date(value?: string | null) {
  if (!value) return '—'
  const result = new Date(value)
  return Number.isNaN(result.getTime()) ? '—' : result.toLocaleString('es-CR')
}
function status(value: string) {
  return ({
    PENDING_REVIEW: 'Pendiente de Pricing',
    NO_PRICE_CHANGE_REQUIRED: 'Conciliado',
    REVISION_REQUIRED: 'Requiere revisión',
    REJECTED: 'Rechazado',
  } as Record<string, string>)[value] || value.replaceAll('_', ' ')
}
async function load() {
  if (!canReview.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await fetchClient<PagedReview>(
      `/api/pricing/operations-reviews?page=${page.value}&pageSize=${pageSize}`,
      { method: 'GET' })
    rows.value = Array.isArray(data.items) ? data.items : []
    total.value = data.total || 0
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible cargar revisiones.'
  } finally {
    loading.value = false
  }
}
function openReview(review: PricingOperationsReview) {
  if (!canReview.value || review.status === 'REJECTED' ||
      review.status === 'NO_PRICE_CHANGE_REQUIRED') return
  selected.value = review
  decision.value = 'NO_PRICE_CHANGE_REQUIRED'
  reason.value = ''
  error.value = ''
}
async function submitReview() {
  if (!selected.value || !canSubmit.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await fetchClient(
      `/api/pricing/operations-reviews/${selected.value.id}/decision`,
      { method: 'POST', body: {
        outcome: decision.value, reason: reason.value.trim(),
        expectedVersion: selected.value.version,
      } })
    selected.value = null
    notice.value = 'Decisión registrada para Operations; la QUO aceptada conserva sus importes.'
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la revisión.'
  } finally {
    saving.value = false
  }
}
async function changePage(next: number) {
  page.value = Math.min(Math.max(1, next), pages.value)
  await load()
}
onMounted(() => { void load() })
</script>

<template>
  <div class="mx-auto w-full max-w-[1550px] space-y-5 px-3 py-4 sm:px-6 sm:py-6">
    <DhPageHeader title="Revisiones de Operations" subtitle="Servicios adicionales y discrepancias enviados a evaluación comercial, sin modificar automáticamente la QUO." :icon="ClipboardCheck" :hide-excel-export="true">
      <template #actions>
        <DhButton variant="secondary" :icon="ArrowLeft" label="Volver a Pricing" @click="router.push('/pricing/rates')" />
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{{ error }}</div>
    <div v-if="notice" role="status" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm">{{ notice }}</div>
    <DhCard title="Solicitudes de revisión comercial" subtitle="Pricing es propietario de costos, ventas, márgenes y autorizaciones. Ninguna decisión modifica por sí sola la cotización aceptada.">
      <DhDataTable :columns="columns" :rows="rows" :loading="loading" empty-text="No hay revisiones comerciales pendientes." @row-click="openReview($event)">
        <template #cell-idtra="{ row }">
          <RouterLink :to="`/operations/cases/${row.caseId}`" class="font-bold text-[var(--dh-primary)] hover:underline" @click.stop>{{ row.idtra }}</RouterLink>
        </template>
        <template #cell-serviceCode="{ row }">{{ reviewType(row.serviceCode) }}</template>
        <template #cell-reason="{ row }"><span class="text-sm break-words">{{ row.reason }}</span></template>
        <template #cell-status="{ row }">
          <DhBadge :variant="row.status === 'NO_PRICE_CHANGE_REQUIRED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'">{{ status(row.status) }}</DhBadge>
        </template>
        <template #cell-requestedAtUtc="{ row }">{{ date(row.requestedAtUtc) }}</template>
        <template #cell-actions="{ row }">
          <DhButton size="sm" variant="secondary" label="Revisar"
            :disabled="row.status === 'REJECTED' || row.status === 'NO_PRICE_CHANGE_REQUIRED'"
            @click="openReview(row)" />
        </template>
      </DhDataTable>
      <div class="mt-4 flex items-center justify-between gap-4">
        <p class="text-xs text-[var(--dh-text-muted)]">Página {{ page }} de {{ pages }} · {{ total }} solicitud(es)</p>
        <div class="flex gap-2">
          <DhButton size="sm" variant="secondary" label="Anterior" :disabled="page <= 1 || loading" @click="changePage(page - 1)" />
          <DhButton size="sm" variant="secondary" label="Siguiente" :disabled="page >= pages || loading" @click="changePage(page + 1)" />
        </div>
      </div>
    </DhCard>
    <DhModal :open="Boolean(selected)" title="Resolver revisión comercial" @close="selected = null">
      <div v-if="selected" class="space-y-4">
        <DhCard padding="sm" title="Datos de la solicitud">
          <div class="grid gap-3 sm:grid-cols-2">
            <div><p class="text-xs text-[var(--dh-text-muted)]">Trámite</p><RouterLink :to="`/operations/cases/${selected.caseId}`" class="font-bold text-[var(--dh-primary)] hover:underline">{{ selected.idtra }}</RouterLink></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Tipo</p><p class="text-sm font-semibold">{{ reviewType(selected.serviceCode) }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Fecha de solicitud</p><p class="text-sm">{{ date(selected.requestedAtUtc) }}</p></div>
          </div>
        </DhCard>
        <RouterLink v-if="selected.acceptedOptionId || selected.quoteId" :to="`/pricing/rates/${selected.acceptedOptionId || selected.quoteId}/wizard?mode=view`" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">Consultar QUO aceptada para recotizar</RouterLink>
        <DhCard padding="sm" title="Datos y motivo de modificación"><p class="whitespace-pre-wrap break-words text-sm">{{ selected.reason }}</p></DhCard>
        <DhSelect v-model="decision" label="Decisión de Pricing" :options="decisions" />
        <DhTextarea v-model="reason" label="Motivo obligatorio de resolución" placeholder="Describa la evaluación comercial y el siguiente paso autorizado." />
        <p class="text-xs text-[var(--dh-text-muted)]">Esta decisión no sustituye la aprobación de una modificación de precio.</p>
        <div class="flex justify-end gap-2">
          <DhButton variant="secondary" label="Cancelar" @click="selected = null" />
          <DhButton label="Guardar decisión" :loading="saving" :disabled="!canSubmit" @click="submitReview" />
        </div>
      </div>
    </DhModal>
  </div>
</template>
