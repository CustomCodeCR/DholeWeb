<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DhButton } from '@/shared/components/atoms'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import { RateRequestLeaseService } from '@/modules/pricing/services/rateRequestLeaseService'

const route = useRoute()
const router = useRouter()
const requestId = computed(() => String(route.params.requestId ?? ''))
const ready = ref(false)
const checking = ref(false)
const error = ref('')
const ownerName = ref('')
let heartbeatTimer: number | undefined
let currentId = ''
let generation = 0

async function begin(id: string) {
  const version = ++generation
  ready.value = false
  checking.value = true
  error.value = ''
  try {
    const lease = await RateRequestLeaseService.claim(id)
    if (version !== generation) {
      void RateRequestLeaseService.release(id).catch(() => undefined)
      return
    }
    currentId = id
    ownerName.value = lease.ownerName
    ready.value = true
    heartbeatTimer = window.setInterval(() => {
      void RateRequestLeaseService.heartbeat(id).catch(() => {
        if (version !== generation) return
        ready.value = false
        error.value = 'Se perdió la reserva de esta solicitud. Ya no puede editarla. Regrese al dashboard.'
        if (heartbeatTimer) window.clearInterval(heartbeatTimer)
        heartbeatTimer = undefined
        sessionStorage.removeItem(`dhole:pricing:rate-request:lease:${id}`)
      })
    }, 20000)
  } catch (cause) {
    if (version !== generation) return
    const serverMessage = (cause as { message?: string })?.message
    error.value = serverMessage || 'Otro usuario está atendiendo esta solicitud.'
  } finally {
    if (version === generation) checking.value = false
  }
}

function stop() {
  ++generation
  if (heartbeatTimer) window.clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  ready.value = false
  const id = currentId
  currentId = ''
  if (id) void RateRequestLeaseService.release(id).catch(() => undefined)
}

onMounted(() => { void begin(requestId.value) })
watch(requestId, (next, previous) => {
  if (next === previous) return
  stop()
  void begin(next)
})
onBeforeUnmount(stop)
</script>

<template>
  <section v-if="checking" class="dh-glass rounded-2xl p-6 text-sm font-semibold">
    Reservando solicitud de tarifa…
  </section>
  <section v-else-if="!ready" class="dh-glass rounded-2xl p-6">
    <h2 class="text-lg font-black">Solicitud no disponible</h2>
    <p class="mt-2 text-sm">{{ error || 'No fue posible obtener la reserva.' }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <DhButton @click="begin(requestId)">Reintentar</DhButton>
      <DhButton variant="secondary" @click="router.push('/home')">Volver al dashboard</DhButton>
    </div>
  </section>
  <div v-else>
    <div class="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold">
      Solicitud reservada para {{ ownerName }}. Nadie más puede trabajar esta solicitud mientras esté activa.
    </div>
    <PricingAlternativeWizardCrystal :rate-request-id="requestId" />
  </div>
</template>
