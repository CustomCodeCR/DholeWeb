<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardList, RefreshCcw } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { useToastStore } from '@/core/stores/toastStore'

interface LinkedRequest {
  id: string
  rateId: string
  quoNumber?: string | null
  clientName?: string | null
  sellerName?: string | null
  executiveName?: string | null
  shipmentMode?: string | null
  originName?: string | null
  destinationName?: string | null
  requestedAtUtc: string
  status: string
  priority: string
}
const router = useRouter()
const toast = useToastStore()
const requests = ref<LinkedRequest[]>([])
const search = ref('')
const loading = ref(false)
const error = ref('')
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return requests.value
  return requests.value.filter((request) => [
    request.quoNumber, request.clientName, request.sellerName, request.executiveName,
    request.originName, request.destinationName, request.shipmentMode,
  ].some(value => String(value ?? '').toLocaleLowerCase().includes(term)))
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: '/api/pricing/rate-requests/linked',
      headers: { Accept: 'application/json' },
    })
    requests.value = unwrapListResponse<LinkedRequest>(response as never)
  } catch (cause) {
    requests.value = []
    error.value = 'No fue posible consultar las solicitudes cotizadas.'
    toast.backendError(cause, error.value)
  } finally {
    loading.value = false
  }
}
function openRate(request: LinkedRequest, showRequest: boolean) {
  if (!request.rateId) return
  void router.push({
    name: 'pricing-rate-wizard',
    params: { rateId: request.rateId },
    query: showRequest ? { mode: 'view', solicitud: '1' } : { mode: 'view' },
    hash: showRequest ? '#solicitud-vendedor' : undefined,
  })
}
function formatDate(value: string) {
  return value ? new Date(value).toLocaleString('es-CR') : '—'
}
onMounted(() => { void load() })
</script>

<template>
  <section class="space-y-5 p-1">
    <DhPageHeader title="Solicitudes cotizadas" description="Historial de lo solicitado por Ventas una vez que Pricing creó una tarifa. Abra la solicitud original o la QUO vinculada." />
    <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <ClipboardList class="h-5 w-5 text-[var(--dh-primary)]" />
      <div class="min-w-0 flex-1">
        <strong class="text-sm text-[var(--dh-text)]">{{ filtered.length }} solicitudes</strong>
        <p class="text-xs text-[var(--dh-text-muted)]">Incluye únicamente solicitudes que tienen tarifa vinculada.</p>
      </div>
      <div class="w-full sm:w-80"><DhInput v-model="search" label="Buscar por QUO, cliente, vendedor o ruta" placeholder="Buscar solicitud…" /></div>
      <DhButton label="Actualizar" variant="secondary" :loading="loading" :icon="RefreshCcw" @click="load" />
    </div>
    <p v-if="error" class="rounded-xl border border-amber-500/30 p-4 text-sm text-amber-600">{{ error }}</p>
    <p v-else-if="loading && !requests.length" class="text-sm text-[var(--dh-text-muted)]">Cargando historial…</p>
    <p v-else-if="!filtered.length" class="rounded-2xl border border-[var(--dh-border)] p-6 text-sm text-[var(--dh-text-muted)]">No hay solicitudes vinculadas que coincidan con la búsqueda.</p>
    <div v-else class="overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <table class="w-full min-w-[900px] text-left text-sm">
        <thead class="border-b border-[var(--dh-border)] text-xs uppercase text-[var(--dh-text-muted)]">
          <tr>
            <th class="p-4">QUO</th><th class="p-4">Cliente y ruta</th><th class="p-4">Solicitante</th><th class="p-4">Fecha solicitud</th><th class="p-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id" class="border-b border-[var(--dh-border)] last:border-0">
            <td class="p-4 font-bold">{{ item.quoNumber || 'Tarifa vinculada' }}</td>
            <td class="p-4">
              <strong class="block">{{ item.clientName || 'Cliente no indicado' }}</strong>
              <span class="block text-xs text-[var(--dh-text-muted)]">{{ item.shipmentMode || '—' }} · {{ item.originName || 'Origen' }} → {{ item.destinationName || 'Destino' }}</span>
            </td>
            <td class="p-4">{{ item.sellerName || item.executiveName || '—' }}</td>
            <td class="p-4 text-xs">{{ formatDate(item.requestedAtUtc) }}</td>
            <td class="p-4">
              <div class="flex justify-end gap-2">
                <DhButton label="Ver solicitud" variant="secondary" size="sm" @click="openRate(item, true)" />
                <DhButton label="Ver tarifa" variant="secondary" size="sm" @click="openRate(item, false)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
