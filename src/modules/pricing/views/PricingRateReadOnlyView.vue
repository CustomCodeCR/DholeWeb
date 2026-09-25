<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue'

const props = defineProps<{ rateId: string }>()

const rate = ref<RateDto | null>(null)
const loading = ref(false)
const errorMessage = ref('')

async function loadRate() {
  if (!props.rateId) return

  loading.value = true
  errorMessage.value = ''
  try {
    rate.value = await PricingService.getRate(props.rateId)
  } catch (error) {
    console.error('[PricingRateReadOnlyView] Could not load rate detail.', error)
    rate.value = null
    errorMessage.value = 'No se pudo cargar el detalle de la tarifa.'
  } finally {
    loading.value = false
  }
}

watch(() => props.rateId, () => void loadRate(), { immediate: true })
</script>

<template>
  <div class="min-h-[320px]">
    <div
      v-if="loading && !rate"
      class="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)]"
    >
      <div class="flex items-center gap-3 text-sm font-bold text-[var(--dh-text-muted)]">
        <RefreshCw class="h-5 w-5 animate-spin" />
        Cargando detalle de la tarifa…
      </div>
    </div>

    <div
      v-else-if="errorMessage && !rate"
      class="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[28px] border border-red-500/20 bg-red-500/5 p-6 text-center"
    >
      <AlertTriangle class="h-8 w-8 text-red-500" />
      <div>
        <p class="font-black text-[var(--dh-text)]">{{ errorMessage }}</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          La vista de detalle permanece separada del wizard para evitar que un error del cotizador deje la pantalla en negro.
        </p>
      </div>
      <DhButton label="Reintentar" :icon="RefreshCw" variant="secondary" @click="loadRate" />
    </div>

    <PricingRateDetailDrawer
      v-else-if="rate"
      :rate="rate"
      :on-saved="loadRate"
    />
  </div>
</template>
