<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardList, GitCompareArrows, RefreshCw } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { StorageService } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import PricingSellerHandoffPreview from '@/modules/pricing/components/PricingSellerHandoffPreview.vue'

interface SalesDocument {
  id: string
  categoryLabel: string
  fileName: string
  sizeInBytes: number
}

interface ModificationChange {
  field: string
  action?: string
  original?: string
  requested?: string
}

interface SalesRequest {
  id: string
  kind?: 'New' | 'Modification'
  status?: string
  requestedAtUtc: string
  completedAtUtc?: string | null
  preparedRevisionNumber?: number | null
  sellerName?: string | null
  clientName?: string | null
  executiveName?: string | null
  priority?: string | null
  originName?: string | null
  destinationName?: string | null
  poeName?: string | null
  podName?: string | null
  payload?: {
    kind?: string
    form?: Record<string, unknown>
    requestContext?: Record<string, unknown>
    sellerContext?: Record<string, unknown>
    sellerRouteOriginal?: { polName?: string; poeName?: string; podName?: string }
    pickupLocations?: unknown[]
    supportDocuments?: SalesDocument[]
    modification?: {
      sourceRevisionNumber?: number
      quote?: string
      notes?: string
      changes?: ModificationChange[]
    }
  } | null
}

const props = defineProps<{ rateId: string }>()
const route = useRoute()
const toast = useToastStore()
const requests = ref<SalesRequest[]>([])
const loading = ref(false)
const error = ref('')
const expandedInitially = computed(() => route.query.solicitud === '1' || route.hash === '#solicitud-vendedor')
let sequence = 0

function isModification(request: SalesRequest): boolean {
  return request.kind === 'Modification'
    || request.payload?.kind === 'Modification'
    || Boolean(request.payload?.modification)
}

const originals = computed(() => requests.value.filter(request => !isModification(request)))
const modifications = computed(() => requests.value.filter(isModification))

async function load(rateId = props.rateId) {
  const current = ++sequence
  requests.value = []
  error.value = ''
  if (!rateId) return
  loading.value = true
  try {
    const result = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rate-requests/by-rate/' + encodeURIComponent(rateId) + '/history',
      headers: { Accept: 'application/json' },
    })
    if (current === sequence) {
      requests.value = unwrapListResponse<SalesRequest>(result as never)
    }
  } catch (cause) {
    if (current !== sequence) return
    error.value = 'No se pudo recuperar el historial de solicitudes de Ventas.'
    toast.backendError(cause, error.value)
  } finally {
    if (current === sequence) loading.value = false
  }
}

watch(() => props.rateId, (rateId) => { void load(rateId) }, { immediate: true })

function snapshotFor(request: SalesRequest) {
  const payload = request.payload
  const form = payload?.form ?? {}
  const context = payload?.requestContext ?? {}
  const originalRoute = payload?.sellerRouteOriginal
  return {
    form,
    context,
    sellerContext: payload?.sellerContext ?? {},
    pickupLocations: payload?.pickupLocations ?? [],
    documents: (payload?.supportDocuments ?? []).filter(file => Boolean(file.id && file.fileName)),
    clientName: request.clientName || String(form.clientName || ''),
    executiveName: request.executiveName || request.sellerName || String(form.executiveName || ''),
    originName: String(originalRoute?.polName || context.originName || request.originName || ''),
    destinationName: String(originalRoute?.poeName || context.destinationName || request.destinationName || ''),
    poeName: String(originalRoute?.poeName || context.poeName || request.poeName || context.destinationName || ''),
    podName: String(originalRoute?.podName || context.podName || request.podName || ''),
    priority: request.priority || 'Green',
  }
}

function equipmentFor(request: SalesRequest): string {
  const context = request.payload?.requestContext
  const form = request.payload?.form
  return String(context?.equipmentName || form?.equipmentType || form?.equipmentSize || form?.shipmentMode || '')
}

function servicesFor(request: SalesRequest): string {
  const services = request.payload?.requestContext?.serviceNames
  return Array.isArray(services) ? services.map(String).filter(Boolean).join(', ') : ''
}

function incotermFor(request: SalesRequest): string {
  const context = request.payload?.requestContext
  const form = request.payload?.form
  return String(context?.incotermName || form?.incotermName || form?.incotermCode || '')
}

function isLand(request: SalesRequest): boolean {
  const modality = request.payload?.form?.modality || request.payload?.requestContext?.modality
  return String(modality || '').toLowerCase() === 'land'
}

function dateLabel(value?: string | null): string {
  if (!value) return 'Fecha no disponible'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-CR')
}

function statusLabel(value?: string): string {
  const labels: Record<string, string> = {
    Open: 'Pendiente', Completed: 'Completada', Cancelled: 'Cancelada',
  }
  return labels[value || ''] || value || 'Estado no disponible'
}

async function download(document: SalesDocument) {
  try {
    await StorageService.downloadFile({ id: document.id, fileName: document.fileName })
  } catch (cause) {
    toast.backendError(cause, 'No se pudo descargar el respaldo enviado por Ventas.')
  }
}
</script>

<template>
  <section id="solicitud-vendedor" class="mt-4 space-y-3" aria-label="Solicitudes de Ventas vinculadas a la tarifa">
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
      <div class="flex min-w-0 items-center gap-3">
        <ClipboardList class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
        <div>
          <h3 class="text-sm font-black">Solicitudes del vendedor</h3>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
            {{ originals.length }} original{{ originals.length === 1 ? '' : 'es' }} ·
            {{ modifications.length }} modificación{{ modifications.length === 1 ? '' : 'es' }}
            · Historial de Ventas separado de las revisiones de la QUO
          </p>
        </div>
      </div>
      <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold" :disabled="loading" @click="load()">
        <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': loading }" />
        Actualizar
      </button>
    </div>

    <p v-if="loading" role="status" class="px-3 py-2 text-xs text-[var(--dh-text-muted)]">Consultando solicitudes vinculadas…</p>
    <p v-else-if="error" role="alert" class="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">{{ error }}</p>
    <p v-else-if="!requests.length" class="rounded-xl border border-[var(--dh-border)] px-4 py-3 text-xs text-[var(--dh-text-muted)]">
      No se encontraron solicitudes de Ventas vinculadas a esta tarifa. Las tarifas creadas directamente por Pricing pueden no tener solicitud original.
    </p>
    <template v-else>
      <div class="space-y-2">
        <h4 class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Solicitud original de Ventas</h4>
        <p v-if="!originals.length" class="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
          Hay solicitudes de modificación vinculadas, pero no se encontró la solicitud original. Se conserva el historial disponible.
        </p>
        <details v-for="request in originals" :key="request.id" :open="expandedInitially" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
          <summary class="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <ClipboardList class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
            <div class="min-w-0 flex-1">
              <strong class="block text-sm">Solicitud original · {{ request.sellerName || request.executiveName || 'Vendedor no indicado' }}</strong>
              <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ dateLabel(request.requestedAtUtc) }} · {{ statusLabel(request.status) }}</span>
            </div>
            <span class="text-xs font-bold text-[var(--dh-primary)]">Ver solicitud / ocultar</span>
          </summary>
          <div class="border-t border-[var(--dh-border)] p-3 md:p-4">
            <PricingSellerHandoffPreview
              :snapshot="snapshotFor(request)"
              :equipment-label="equipmentFor(request)"
              :service-labels="servicesFor(request)"
              :origin-label="snapshotFor(request).originName"
              :destination-label="snapshotFor(request).destinationName"
              :pod-label="snapshotFor(request).podName"
              :incoterm-label="incotermFor(request)"
              :is-land="isLand(request)"
              title="¿Qué solicitó originalmente el vendedor?"
              subtitle="Datos originales guardados al solicitar la tarifa · solo lectura"
              @download="download"
            />
          </div>
        </details>
      </div>

      <div class="space-y-2">
        <h4 class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">
          <GitCompareArrows class="h-4 w-4" /> Solicitudes de modificación · {{ modifications.length }}
        </h4>
        <p v-if="!modifications.length" class="rounded-xl border border-[var(--dh-border)] px-4 py-3 text-xs text-[var(--dh-text-muted)]">No hay modificaciones solicitadas por Ventas para esta tarifa.</p>
        <details v-for="request in modifications" :key="request.id" :open="expandedInitially" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
          <summary class="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <GitCompareArrows class="h-5 w-5 shrink-0 text-amber-600" />
            <div class="min-w-0 flex-1">
              <strong class="block text-sm">Modificación de Ventas · {{ request.sellerName || request.executiveName || 'Vendedor no indicado' }}</strong>
              <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">
                {{ dateLabel(request.requestedAtUtc) }} · {{ statusLabel(request.status) }}
                · Revisión de origen {{ request.payload?.modification?.sourceRevisionNumber ?? '—' }}
                · {{ request.payload?.modification?.changes?.length ?? 0 }} diferencias
              </span>
            </div>
            <span class="text-xs font-bold text-[var(--dh-primary)]">Ver modificación / ocultar</span>
          </summary>
          <div class="space-y-4 border-t border-[var(--dh-border)] p-3 md:p-4">
            <p v-if="request.payload?.modification?.notes" class="whitespace-pre-wrap rounded-xl border border-[var(--dh-border)] p-3 text-xs">
              <strong>Indicaciones del vendedor:</strong> {{ request.payload.modification.notes }}
            </p>
            <div v-if="request.payload?.modification?.changes?.length" class="overflow-x-auto rounded-xl border border-[var(--dh-border)]">
              <table class="w-full min-w-[620px] text-left text-xs">
                <thead class="bg-[var(--dh-card-hover)] text-[var(--dh-text-muted)]">
                  <tr><th class="p-3">Campo</th><th class="p-3">Acción</th><th class="p-3">Valor original</th><th class="p-3">Solicitado por Ventas</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(change, index) in request.payload.modification.changes" :key="index" class="border-t border-[var(--dh-border)]">
                    <td class="p-3 font-bold">{{ change.field }}</td>
                    <td class="p-3">{{ change.action || 'Modificar' }}</td>
                    <td class="max-w-[300px] break-words p-3 text-[var(--dh-text-muted)]">{{ change.original || '—' }}</td>
                    <td class="max-w-[360px] break-words p-3 font-bold">{{ change.requested || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-xs text-[var(--dh-text-muted)]">Esta solicitud no tiene una lista de diferencias guardada; se muestran los datos enviados por Ventas.</p>
            <PricingSellerHandoffPreview
              :snapshot="snapshotFor(request)"
              :equipment-label="equipmentFor(request)"
              :service-labels="servicesFor(request)"
              :origin-label="snapshotFor(request).originName"
              :destination-label="snapshotFor(request).destinationName"
              :pod-label="snapshotFor(request).podName"
              :incoterm-label="incotermFor(request)"
              :is-land="isLand(request)"
              title="Información enviada en esta modificación"
              subtitle="Copia histórica de la solicitud · no sustituye la cotización vigente"
              @download="download"
            />
          </div>
        </details>
      </div>
    </template>
  </section>
</template>
