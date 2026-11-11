<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import type { RateDto } from '@/core/interfaces/pricing'
import { PricingService } from '@/core/services/pricingService'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rateId: string
  onLinked?: () => void | Promise<void>
}>()

const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const source = ref<RateDto | null>(null)
const loading = ref(true)
const searching = ref(false)
const saving = ref(false)
const search = ref('')
const selectedRateId = ref('')
const acceptedRates = ref<RateDto[]>([])
const errorMessage = ref('')

const allowedStatuses = new Set([
  'Open', 'Sent', 'RequestedByClient', 'Expired', 'RejectedByClient', 'Closed', 'QUOVinculada',
])
const canEdit = computed(() =>
  authStore.hasScope(PRICING_SCOPES.rates.update)
  || authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin),
)
const canLink = computed(() =>
  Boolean(source.value && allowedStatuses.has(source.value.status)
    && source.value.rateType !== 'Tariff' || source.value
      && allowedStatuses.has(source.value.status)
      && !String(source.value.clientName ?? '').toUpperCase().includes('TARIFARIO'))
  && canEdit.value,
)

function sameClient(a: RateDto, b: RateDto): boolean {
  if (a.clientAccountId || b.clientAccountId)
    return Boolean(a.clientAccountId && a.clientAccountId === b.clientAccountId)
  if (a.clientLeadId || b.clientLeadId)
    return Boolean(a.clientLeadId && a.clientLeadId === b.clientLeadId)
  return Boolean(a.clientName?.trim() &&
    a.clientName.trim().toLocaleUpperCase() === b.clientName?.trim().toLocaleUpperCase())
}

const options = computed(() => acceptedRates.value.map(rate => ({
  value: rate.id,
  label: `${rate.quoNumber || rate.rateCode} · ${rate.clientName || 'Sin cliente'}`,
})))

async function loadSource() {
  loading.value = true
  try {
    source.value = await PricingService.getRate(props.rateId)
    if (source.value.linkedAcceptedRateId) {
      const accepted = await PricingService.getRate(source.value.linkedAcceptedRateId).catch(() => null)
      if (accepted?.status === 'AcceptedByClient') {
        acceptedRates.value = [accepted]
        selectedRateId.value = accepted.id
        search.value = accepted.quoNumber || accepted.rateCode
      }
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo consultar la QUO original.')
    errorMessage.value = 'No se pudo cargar la cotización. Cierre esta ventana e inténtelo nuevamente.'
  } finally {
    loading.value = false
  }
}

async function findAcceptedQuotes() {
  if (!source.value || !canLink.value || searching.value) return
  const text = search.value.trim()
  if (!text) {
    errorMessage.value = 'Escriba el número de la QUO que el cliente sí aceptó.'
    return
  }
  searching.value = true
  errorMessage.value = ''
  selectedRateId.value = ''
  acceptedRates.value = []
  try {
    const result = await PricingService.browseRates({
      statuses: ['AcceptedByClient'], search: text, pageNumber: 1, pageSize: 100,
    })
    acceptedRates.value = result.items.filter(rate =>
      rate.status === 'AcceptedByClient' && rate.id !== source.value?.id
      && sameClient(source.value!, rate),
    )
    if (!acceptedRates.value.length)
      errorMessage.value = 'No se encontró una QUO aceptada para este mismo cliente. Verifique su número.'
  } catch (error) {
    errorMessage.value = 'No fue posible buscar las cotizaciones aceptadas.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    searching.value = false
  }
}

async function saveLink() {
  const target = acceptedRates.value.find(rate => rate.id === selectedRateId.value)
  if (!source.value || !canLink.value || !target || saving.value) {
    errorMessage.value = 'Seleccione una QUO aceptada válida del mismo cliente.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await PricingService.setRateStatus(source.value.id, {
      status: 'QUOVinculada',
      linkedAcceptedRateId: target.id,
    })
    await props.onLinked?.()
    toastStore.success('QUO vinculada', `La cotización original quedó vinculada a ${target.quoNumber || target.rateCode}. No contará como vencida o no aceptada.`)
    modalStore.close()
  } catch (error) {
    errorMessage.value = 'No se pudo guardar el vínculo. Verifique que la QUO destino continúe aceptada.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(loadSource)
</script>

<template>
  <section class="space-y-4">
    <p v-if="loading" class="text-sm font-semibold text-[var(--dh-text-muted)]">Consultando la cotización...</p>
    <template v-else-if="source">
      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">QUO que será vinculada</p>
        <p class="mt-1 text-base font-black text-[var(--dh-text)]">{{ source.quoNumber || source.rateCode }}</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ source.clientName || 'Cliente sin nombre' }}</p>
        <p class="mt-2 text-xs font-semibold">Estado actual: {{ source.status }}</p>
      </div>
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        Esta acción cambia el estado de la QUO indicada arriba; no crea ni acepta automáticamente una tarifa nueva.
        La cotización ganadora debe estar aceptada y pertenecer al mismo cliente.
      </p>
      <template v-if="canLink">
        <div class="flex flex-wrap items-end gap-2">
          <div class="min-w-[220px] flex-1">
            <DhInput v-model="search" label="Número de QUO aceptada" placeholder="QUO-00000-000618" @keyup.enter="findAcceptedQuotes" />
          </div>
          <DhButton variant="secondary" :loading="searching" :disabled="searching || saving" @click="findAcceptedQuotes">Buscar</DhButton>
        </div>
        <DhSelect v-model="selectedRateId" label="QUO aceptada del mismo cliente" placeholder="Seleccione la QUO aceptada" :options="options" :disabled="searching || saving || !options.length" />
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" :disabled="saving" @click="modalStore.close()">Cancelar</DhButton>
          <DhButton :loading="saving" :disabled="saving || !selectedRateId || !acceptedRates.some(rate => rate.id === selectedRateId)" @click="saveLink">
            Confirmar vínculo
          </DhButton>
        </div>
      </template>
      <p v-else class="text-xs font-bold text-amber-600">La QUO no permite este cambio de estado o el usuario no tiene permisos para modificarlo.</p>
    </template>
    <p v-if="errorMessage" role="alert" class="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs font-bold text-red-500">{{ errorMessage }}</p>
  </section>
</template>
