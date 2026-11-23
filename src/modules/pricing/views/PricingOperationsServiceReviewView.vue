<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardCheck, RefreshCcw } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'

interface Review {
  id: string
  quoteId: string
  caseId: string
  idtra: string
  serviceCode: string
  serviceName: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedAtUtc: string
  resolutionNotes?: string | null
}
const router = useRouter()
const auth = useAuthStore()
const toast = useToastStore()
const rows = ref<Review[]>([])
const loading = ref(false)
const error = ref('')
const chosenStatus = ref<'PENDING' | 'ALL'>('PENDING')
const noteById = reactive<Record<string, string>>({})
const deciding = ref<string | null>(null)
const filtered = computed(() => chosenStatus.value === 'ALL' ? rows.value
  : rows.value.filter(row => row.status === 'PENDING'))
const canDecide = computed(() => auth.hasScope('pricing.rate.update'))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await callEndpoint<Review[]>({
      method: 'GET',
      path: '/api/pricing/operations-service-reviews',
      headers: { Accept: 'application/json' },
    })
    rows.value = Array.isArray(response) ? response : []
  } catch (cause) {
    error.value = 'No fue posible consultar las revisiones de servicios adicionales.'
    toast.backendError(cause, error.value)
  } finally { loading.value = false }
}
async function decide(review: Review, decision: 'APPROVED' | 'REJECTED') {
  if (deciding.value || !canDecide.value || !noteById[review.id]?.trim()) return
  deciding.value = review.id
  error.value = ''
  try {
    await callEndpoint({
      method: 'POST',
      path: '/api/pricing/operations-service-reviews/' + encodeURIComponent(review.id) + '/decision',
      data: { decision, notes: noteById[review.id].trim() },
    })
    toast.success('Decisión registrada. Operations recibirá el resultado mediante Redis.')
    await load()
  } catch (cause) {
    error.value = 'No se pudo registrar la decisión en Pricing.'
    toast.backendError(cause, error.value)
  } finally { deciding.value = null }
}
onMounted(() => { void load() })
</script>

<template>
  <section class="space-y-5 p-1">
    <DhPageHeader title="Revisión comercial de Operaciones"
      description="Servicios agregados durante Aperturas u Origen que no estaban cotizados; aprobar o rechazar no modifica la QUO original."
      :icon="ClipboardCheck" />
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-[220px]">
        <DhSelect v-model="chosenStatus" label="Estado"
          :options="[{label:'Pendientes',value:'PENDING'},{label:'Todas',value:'ALL'}]" />
      </div>
      <DhButton :icon="RefreshCcw" variant="secondary" label="Actualizar"
        :loading="loading" @click="load" />
    </div>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-if="!filtered.length && !loading" class="text-sm text-[var(--dh-text-muted)]">
      No hay servicios por revisar para este filtro.
    </p>
    <DhCard v-for="item in filtered" :key="item.id"
      :title="item.serviceName" :subtitle="item.serviceCode + ' · ' + (item.idtra || 'Sin IDTRA')">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <DhBadge :variant="item.status === 'PENDING' ? 'warning' : item.status === 'APPROVED' ? 'success' : 'neutral'">
            {{ item.status === 'PENDING' ? 'Pendiente de Pricing' : item.status === 'APPROVED' ? 'Aprobado' : 'Rechazado' }}
          </DhBadge>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ new Date(item.requestedAtUtc).toLocaleString('es-CR') }}</span>
        </div>
        <p class="whitespace-pre-wrap text-sm">{{ item.reason }}</p>
        <div class="flex flex-wrap gap-3">
          <DhButton variant="secondary" size="sm" label="Ver trámite"
            @click="router.push({ name: 'operations-case-detail', params: { id: item.caseId } })" />
          <DhButton variant="secondary" size="sm" label="Ver QUO"
            @click="router.push({ name: 'pricing-rate-wizard', params: { rateId: item.quoteId }, query: { mode: 'view' } })" />
        </div>
        <div v-if="item.status === 'PENDING' && canDecide" class="space-y-3">
          <DhTextarea v-model="noteById[item.id]" label="Motivo de la decisión (obligatorio)" :rows="2" />
          <div class="flex flex-wrap gap-2">
            <DhButton label="Aprobar revisión" :loading="deciding === item.id"
              :disabled="!noteById[item.id]?.trim() || !!deciding" @click="decide(item, 'APPROVED')" />
            <DhButton label="Rechazar revisión" variant="danger" :loading="deciding === item.id"
              :disabled="!noteById[item.id]?.trim() || !!deciding" @click="decide(item, 'REJECTED')" />
          </div>
        </div>
        <p v-else-if="item.resolutionNotes" class="text-xs text-[var(--dh-text-muted)]">
          Resolución de Pricing: {{ item.resolutionNotes }}
        </p>
      </div>
    </DhCard>
  </section>
</template>
