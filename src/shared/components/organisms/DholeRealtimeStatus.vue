<script setup lang="ts">
import { computed } from 'vue'
import {
  UNIVERSAL_REALTIME_ENABLED,
  universalRealtimeStatus,
} from '@/core/realtime/universalRealtime'

const statusText = computed(() => ({
  connecting: 'Conectando actualizaciones',
  connected: 'Actualizaciones activas',
  reconnecting: 'Reconectando actualizaciones',
  degraded: 'Sincronizando mediante REST',
  offline: 'Sin conexión · datos anteriores',
  unauthorized: 'Actualizaciones requieren nueva sesión',
})[universalRealtimeStatus.value])
</script>

<template>
  <div
    v-if="UNIVERSAL_REALTIME_ENABLED"
    class="flex justify-end px-4 pt-1 text-[11px] font-medium text-[var(--dh-text-muted)]"
    role="status"
    aria-live="polite"
    data-dhole-realtime-status
  >
    <span
      class="mr-1.5 mt-[4px] inline-block h-1.5 w-1.5 rounded-full bg-current"
      aria-hidden="true"
    />
    {{ statusText }}
  </div>
</template>
