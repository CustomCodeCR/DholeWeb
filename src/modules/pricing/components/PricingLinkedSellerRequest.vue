<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ClipboardList } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { StorageService } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import PricingSellerHandoffPreview from '@/modules/pricing/components/PricingSellerHandoffPreview.vue'

interface SalesDocument {
  id: string
  categoryLabel: string
  fileName: string
  sizeInBytes: number
}
interface SalesRequest {
  id: string
  requestedAtUtc: string
  sellerName?: string | null
  clientName?: string | null
  executiveName?: string | null
  priority?: string | null
  originName?: string | null
  destinationName?: string | null
  poeName?: string | null
  podName?: string | null
  payload?: {
    form?: Record<string, unknown>
    requestContext?: Record<string, unknown>
    sellerContext?: Record<string, unknown>
    pickupLocations?: unknown[]
    supportDocuments?: SalesDocument[]
  } | null
}
const props = defineProps<{ rateId: string }>()
const route = useRoute()
const toast = useToastStore()
const request = ref<SalesRequest | null>(null)
const loading = ref(false)
const error = ref('')
const expandedInitially = computed(() => route.query.solicitud === '1' || route.hash === '#solicitud-vendedor')
let sequence = 0

watch(() => props.rateId, async (rateId) => {
  const current = ++sequence
  request.value = null
  error.value = ''
  if (!rateId) return
  loading.value = true
  try {
    const result = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/rate-requests/by-rate/${encodeURIComponent(rateId)}`,
      headers: { Accept: 'application/json' },
    })
    if (current === sequence) request.value = unwrapApiResponse<SalesRequest>(result as never)
  } catch (cause) {
    if (current !== sequence) return
    const status = (cause as { status?: number; statusCode?: number })?.status
      ?? (cause as { statusCode?: number })?.statusCode
    if (status !== 404) error.value = 'No se pudo recuperar la solicitud de Ventas.'
  } finally {
    if (current === sequence) loading.value = false
  }
}, { immediate: true })

const snapshot = computed(() => {
  const data = request.value
  const payload = data?.payload
  const form = payload?.form ?? {}
  const context = payload?.requestContext ?? {}
  const sellerContext = payload?.sellerContext ?? {}
  return {
    form,
    context,
    sellerContext,
    pickupLocations: payload?.pickupLocations ?? [],
    documents: (payload?.supportDocuments ?? []).filter(file => Boolean(file.id && file.fileName)),
    clientName: data?.clientName || String(form.clientName || ''),
    executiveName: data?.executiveName || data?.sellerName || String(form.executiveName || ''),
    originName: data?.originName || String(context.originName || ''),
    destinationName: data?.destinationName || String(context.destinationName || ''),
    poeName: data?.poeName || String(context.poeName || ''),
    podName: data?.podName || String(context.podName || ''),
    priority: data?.priority || 'Green',
  }
})
const equipmentLabel = computed(() => String(
  snapshot.value.context.equipmentName || snapshot.value.form.equipmentType || snapshot.value.form.equipmentSize || '',
))
const serviceLabels = computed(() => {
  const names = snapshot.value.context.serviceNames
  return Array.isArray(names) ? names.map(String).filter(Boolean).join(', ') : ''
})
const incotermLabel = computed(() => String(
  snapshot.value.context.incotermName || snapshot.value.form.incotermName || snapshot.value.form.incotermCode || '',
))
const isLand = computed(() => String(snapshot.value.form.modality || snapshot.value.context.modality).toLowerCase() === 'land')
const requestedOn = computed(() => request.value?.requestedAtUtc
  ? new Date(request.value.requestedAtUtc).toLocaleString('es-CR') : '')
async function download(document: SalesDocument) {
  try {
    await StorageService.downloadFile({ id: document.id, fileName: document.fileName })
  } catch (cause) {
    toast.backendError(cause, 'No se pudo descargar el respaldo enviado por Ventas.')
  }
}
</script>

<template>
  <section v-if="request || loading || error" id="solicitud-vendedor" class="mt-4">
    <p v-if="loading" class="text-xs font-semibold text-[var(--dh-text-muted)]">Consultando solicitud original de Ventas…</p>
    <p v-else-if="error" class="rounded-xl border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-300">{{ error }}</p>
    <details v-else :open="expandedInitially" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <summary class="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <ClipboardList class="h-5 w-5 text-[var(--dh-primary)]" />
        <div class="min-w-0 flex-1">
          <strong class="block text-sm text-[var(--dh-text)]">Solicitud original de Ventas</strong>
          <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">
            {{ request?.sellerName || 'Vendedor' }} · {{ requestedOn }} · Datos solicitados antes de cotizar
          </span>
        </div>
        <span class="text-xs font-bold text-[var(--dh-primary)]">Mostrar / ocultar detalle</span>
      </summary>
      <div class="border-t border-[var(--dh-border)] p-3 md:p-4">
        <PricingSellerHandoffPreview
          :snapshot="snapshot"
          :equipment-label="equipmentLabel"
          :service-labels="serviceLabels"
          :origin-label="snapshot.originName"
          :destination-label="snapshot.destinationName"
          :pod-label="snapshot.podName"
          :incoterm-label="incotermLabel"
          :is-land="isLand"
          title="¿Qué solicitó originalmente el vendedor?"
          subtitle="Datos guardados al solicitar la tarifa · solo lectura, no se reemplazan con la cotización final"
          @download="download"
        />
      </div>
    </details>
  </section>
</template>
