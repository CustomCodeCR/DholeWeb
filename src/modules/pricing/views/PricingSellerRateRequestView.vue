<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useToastStore } from '@/core/stores/toastStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import SellerGuideButton from '@/modules/pricing/components/SellerGuideButton.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()
const activeWizardStep = ref(1)
function syncTourStep() {
  const active = document.querySelector('.pricing-crystal-shell .crystal-step--active')
  const number = Number(active?.querySelector('span')?.textContent?.trim())
  if (number >= 1 && number <= 9) activeWizardStep.value = number
}
let observer: MutationObserver | null = null
let editGuardTimer: number | undefined
let editGuardChecking = false
let editGuardRedirected = false

// Pricing can claim a request while the seller already has its edit tab open.
// Keep that tab synchronized; the server independently rejects stale PUTs.
async function verifySellerEditAccess() {
  const id = sellerEditRequestId.value
  if (!id || document.hidden || editGuardChecking || editGuardRedirected) return
  editGuardChecking = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rate-requests/mine/' + encodeURIComponent(id),
      headers: { Accept: 'application/json' },
    })
    const request = unwrapApiResponse<{
      status: string
      rateId?: string | null
      lockedByUserId?: string | null
      lockedByName?: string | null
      lockExpiresAtUtc?: string | null
    }>(response as never)
    const claimed = Boolean(request.lockedByUserId && request.lockExpiresAtUtc
      && new Date(request.lockExpiresAtUtc).getTime() > Date.now())
    if (request.status !== 'Open' || request.rateId || claimed) {
      editGuardRedirected = true
      toast.warning('Edición bloqueada', claimed
        ? (request.lockedByName || 'Pricing') + ' ya tomó esta solicitud. Sus cambios no se pueden guardar.'
        : 'La solicitud ya está siendo procesada o fue completada.')
      await router.replace('/home')
    }
  } catch {
    // A temporary connection error must not discard an unfinished form.
    // The PUT endpoint always checks the current claim atomically.
  } finally {
    editGuardChecking = false
  }
}

function onSellerEditVisible() {
  if (!document.hidden) void verifySellerEditAccess()
}

onMounted(() => {
  syncTourStep()
  observer = new MutationObserver(syncTourStep)
  observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] })
  if (sellerEditRequestId.value) {
    editGuardTimer = window.setInterval(() => { void verifySellerEditAccess() }, 5000)
    document.addEventListener('visibilitychange', onSellerEditVisible)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (editGuardTimer !== undefined) window.clearInterval(editGuardTimer)
  document.removeEventListener('visibilitychange', onSellerEditVisible)
})
const sellerEditRequestId = computed(() => String(route.params.requestId ?? '').trim() || null)
const sellerDuplicateRequestId = computed(() => {
  const value = route.query.duplicateRequestId
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null
})
const sellerModificationRateId = computed(() => {
  const value = route.query.modifyRateId
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : null
})
</script>

<template>
  <div data-seller-guide="request-intro" class="space-y-3">
    <div class="flex flex-wrap items-center justify-end gap-2">
      <SellerGuideButton context="request" :modification="Boolean(sellerModificationRateId)"
        :step="activeWizardStep" />
    </div>
    <PricingAlternativeWizardCrystal seller-request-mode
      :key="sellerDuplicateRequestId ?? sellerEditRequestId ?? sellerModificationRateId ?? 'new-request'"
      :seller-edit-request-id="sellerEditRequestId"
      :seller-duplicate-request-id="sellerDuplicateRequestId"
      :seller-modification-rate-id="sellerModificationRateId" />
  </div>
</template>
