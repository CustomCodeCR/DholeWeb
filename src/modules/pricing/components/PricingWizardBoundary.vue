<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { AlertTriangle, RefreshCw } from 'lucide-vue-next'

const error = ref('')
const retryKey = ref(0)
onErrorCaptured((cause, _instance, info) => {
  const description = cause instanceof Error ? cause.message : String(cause)
  error.value = description + (info ? ' (' + info + ')' : '')
  console.error('[PricingWizard] Error al renderizar o montar el formulario', cause, info)
  // Avoid leaving a completely blank pricing page when a child fails.
  return false
})
function retry() {
  error.value = ''
  retryKey.value++
}
</script>

<template>
  <section v-if="error" role="alert"
    class="mx-auto mt-6 max-w-3xl space-y-4 rounded-2xl border border-red-400/40 bg-[var(--dh-card)] p-6">
    <div class="flex items-center gap-3">
      <AlertTriangle class="h-6 w-6 shrink-0 text-red-500" />
      <h2 class="text-lg font-bold">No se pudo cargar el formulario de tarifas</h2>
    </div>
    <p class="text-sm text-[var(--dh-text-muted)]">
      Se detectó un error al abrir el wizard. No se ha creado ni modificado ninguna tarifa por este error.
    </p>
    <pre class="overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--dh-shell)] p-3 text-xs">{{ error }}</pre>
    <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-bold text-white"
      @click="retry"><RefreshCw class="h-4 w-4" />Reintentar carga</button>
  </section>
  <div v-else :key="retryKey"><slot /></div>
</template>
