<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, MessageSquareText, RefreshCw, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { toQueryString } from '@/core/api/queryString'
import { PricingService } from '@/core/services/pricingService'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import PricingImportReviewDrawer from '@/modules/pricing/components/PricingImportReviewDrawer.vue'
import PricingReasonModal from '@/modules/pricing/components/PricingReasonModal.vue'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

type QueueStatus = '' | 'Pending' | 'Approved' | 'Rejected' | 'Created'
type QueueSource = '' | 'Email' | 'Pdf' | 'Excel' | 'Csv' | 'Image'

interface ReviewQueueItem {
  id: string
  importBatchId: string
  sourceType: string
  carrier: string
  agent: string
  pol: string
  poe: string
  pod: string
  containerType: string
  currency: string
  freight: number
  validFrom: string
  validTo: string
  status: string
  spaceComment?: string | null
  createdAt: string
}

const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()

const rows = ref<ReviewQueueItem[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const processing = ref(false)
const filters = reactive({
  search: '',
  sourceType: '' as QueueSource,
  status: 'Pending' as QueueStatus,
  createdFrom: '',
  createdTo: '',
})

const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pendientes', value: 'Pending' },
  { label: 'Aprobadas', value: 'Approved' },
  { label: 'Rechazadas', value: 'Rejected' },
  { label: 'Utilizadas', value: 'Created' },
]
const sourceOptions = [
  { label: 'Todos los orígenes', value: '' },
  { label: 'Correo', value: 'Email' },
  { label: 'PDF', value: 'Pdf' },
  { label: 'Excel', value: 'Excel' },
  { label: 'CSV', value: 'Csv' },
  { label: 'Imagen', value: 'Image' },
]

const selectedPendingIds = computed(() =>
  rows.value
    .filter((row) => row.status === 'Pending' && selectedIds.value.includes(row.id))
    .map((row) => row.id),
)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.includes(row.id)),
)

function statusLabel(value: string) {
  return ({
    Pending: 'Pendiente',
    Approved: 'Aprobada',
    Rejected: 'Rechazada',
    Created: 'Utilizada',
  } as Record<string, string>)[value] ?? value
}

function statusVariant(value: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'Approved' || value === 'Created') return 'success'
  if (value === 'Pending') return 'warning'
  if (value === 'Rejected') return 'danger'
  return 'neutral'
}

function sourceLabel(value: string) {
  return ({ Email: 'Correo', Pdf: 'PDF', Excel: 'Excel', Csv: 'CSV', Image: 'Imagen' } as Record<string, string>)[value] ?? value
}

async function load() {
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path:
        '/api/pricing/import-rates/review-queue' +
        toQueryString({
          search: filters.search || undefined,
          sourceType: filters.sourceType || undefined,
          status: filters.status || undefined,
          createdFrom: filters.createdFrom || undefined,
          createdTo: filters.createdTo || undefined,
          take: 500,
        }),
      headers: { Accept: 'application/json' },
    })
    rows.value = unwrapListResponse<ReviewQueueItem>(response)
    selectedIds.value = selectedIds.value.filter((id) => rows.value.some((row) => row.id === id))
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la cola de revisión.')
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filters.search = ''
  filters.sourceType = ''
  filters.status = 'Pending'
  filters.createdFrom = ''
  filters.createdTo = ''
  load()
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : rows.value.map((row) => row.id)
}

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((current) => current !== id)
    : [...selectedIds.value, id]
}

async function approve(ids: string[]) {
  const pending = ids.filter((id) => rows.value.some((row) => row.id === id && row.status === 'Pending'))
  if (!pending.length || processing.value) return
  try {
    processing.value = true
    await PricingService.approveImportRates(pending)
    toastStore.success(`${pending.length} tarifa${pending.length === 1 ? '' : 's'} aprobada${pending.length === 1 ? '' : 's'}`)
    selectedIds.value = []
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron aprobar las tarifas.')
  } finally {
    processing.value = false
  }
}

function reject(ids: string[]) {
  const pending = ids.filter((id) => rows.value.some((row) => row.id === id && row.status === 'Pending'))
  if (!pending.length) return
  modalStore.open({
    title: 'Rechazar tarifas',
    component: PricingReasonModal,
    props: {
      target: 'import',
      ids: pending,
      onSaved: async () => {
        selectedIds.value = []
        await load()
      },
    },
  })
}

async function openReview(row: ReviewQueueItem) {
  try {
    const detail = await PricingService.getImportRate(row.id)
    drawerStore.open({
      title: 'Revisar tarifa recibida',
      component: PricingImportReviewDrawer,
      size: 'full',
      props: {
        importRate: detail,
        canApprove: row.status === 'Pending',
        onSaved: load,
        onApproved: load,
      },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo abrir la tarifa.')
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Revisión de tarifas recibidas"
      description="Revise, comente, apruebe o rechace sin salir de esta pestaña."
    >
      <template #actions>
        <DhButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCw class="h-4 w-4" />
          Actualizar
        </DhButton>
      </template>
    </DhPageHeader>

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DhInput v-model="filters.search" label="Buscar" placeholder="Naviera, ruta, equipo..." @keyup.enter="load" />
        <DhSelect v-model="filters.sourceType" label="Origen" :options="sourceOptions" />
        <DhSelect v-model="filters.status" label="Estado" :options="statusOptions" />
        <DhInput v-model="filters.createdFrom" type="date" label="Cargada desde" />
        <DhInput v-model="filters.createdTo" type="date" label="Cargada hasta" />
      </div>
      <div class="mt-3 flex flex-wrap justify-end gap-2">
        <DhButton variant="ghost" @click="clearFilters">Limpiar</DhButton>
        <DhButton @click="load">Aplicar filtros</DhButton>
      </div>
    </section>

    <section
      v-if="selectedPendingIds.length"
      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.25)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-3"
    >
      <div>
        <p class="font-black text-[var(--dh-text)]">{{ selectedPendingIds.length }} pendientes seleccionadas</p>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Aprobación y rechazo por batch.</p>
      </div>
      <div class="flex gap-2">
        <DhButton variant="danger" :disabled="processing" @click="reject(selectedPendingIds)">
          <X class="h-4 w-4" /> Rechazar
        </DhButton>
        <DhButton :disabled="processing" @click="approve(selectedPendingIds)">
          <Check class="h-4 w-4" /> Aprobar
        </DhButton>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="border-b border-[var(--dh-border)] bg-black/[0.025] dark:bg-white/[0.025]">
            <tr class="text-left text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">
              <th class="px-4 py-3">
                <input type="checkbox" :checked="allSelected" aria-label="Seleccionar todas" @change="toggleAll" />
              </th>
              <th class="px-4 py-3">Cargada</th>
              <th class="px-4 py-3">Origen</th>
              <th class="px-4 py-3">Naviera / Agente</th>
              <th class="px-4 py-3">Ruta</th>
              <th class="px-4 py-3">Equipo</th>
              <th class="px-4 py-3 text-right">Flete</th>
              <th class="px-4 py-3">Vigencia</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-4 py-12 text-center font-semibold text-[var(--dh-text-muted)]">Cargando...</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="10" class="px-4 py-12 text-center font-semibold text-[var(--dh-text-muted)]">No hay tarifas con esos filtros.</td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-[var(--dh-border)] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            >
              <td class="px-4 py-3">
                <input type="checkbox" :checked="selectedIds.includes(row.id)" :aria-label="`Seleccionar ${row.carrier}`" @change="toggle(row.id)" />
              </td>
              <td class="whitespace-nowrap px-4 py-3 font-semibold">{{ formatDate(row.createdAt) }}</td>
              <td class="px-4 py-3"><DhBadge variant="neutral">{{ sourceLabel(row.sourceType) }}</DhBadge></td>
              <td class="px-4 py-3">
                <p class="font-black text-[var(--dh-text)]">{{ row.carrier || '—' }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ row.agent || 'Por asignar' }}</p>
              </td>
              <td class="min-w-[220px] px-4 py-3">
                <p class="font-semibold">{{ row.pol }} → {{ row.poe }} → {{ row.pod }}</p>
              </td>
              <td class="px-4 py-3 font-semibold">{{ row.containerType }}</td>
              <td class="px-4 py-3 text-right font-black">{{ formatMoney(row.freight, row.currency || 'USD') }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-xs font-semibold">{{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }}</td>
              <td class="px-4 py-3"><DhBadge :variant="statusVariant(row.status)">{{ statusLabel(row.status) }}</DhBadge></td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <DhButton size="sm" variant="secondary" @click="openReview(row)">
                    <MessageSquareText class="h-4 w-4" /> Revisar
                  </DhButton>
                  <DhButton v-if="row.status === 'Pending'" size="sm" :disabled="processing" @click="approve([row.id])">
                    <Check class="h-4 w-4" /> Aprobar
                  </DhButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
      En “Revisar”, el comentario de espacios sí participa en la recomendación; las notas internas quedan solo como auditoría.
    </p>
  </div>
</template>
