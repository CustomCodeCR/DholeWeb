<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import type { AiExecutionDto, AiExecutionStatus } from '@/core/interfaces/ai'
import {
  executionStatusLabel,
  executionTypeLabel,
  formatAiCost,
  formatAiDate,
  providerLabel,
} from '@/modules/ai/aiOptions'

const props = defineProps<{ execution: AiExecutionDto }>()
const drawerStore = useDrawerStore()

const statusVariant = computed(() => {
  const map: Record<AiExecutionStatus, 'neutral' | 'primary' | 'success' | 'danger' | 'warning'> = {
    Pending: 'neutral',
    Running: 'primary',
    Completed: 'success',
    Failed: 'danger',
    Cancelled: 'warning',
  }
  return map[props.execution.status]
})
</script>

<template>
  <div class="space-y-5">
    <section class="grid gap-4 md:grid-cols-4">
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Estado</p>
        <DhBadge class="mt-3" :label="executionStatusLabel(execution.status)" :variant="statusVariant" />
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tipo</p>
        <p class="mt-3 font-black text-[var(--dh-text)]">{{ executionTypeLabel(execution.executionType) }}</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Duración</p>
        <p class="mt-3 font-black text-[var(--dh-text)]">{{ execution.durationMilliseconds }} ms</p>
      </article>
      <article class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costo estimado</p>
        <p class="mt-3 font-black text-[var(--dh-text)]">{{ formatAiCost(execution.estimatedCost) }}</p>
      </article>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <h3 class="font-black text-[var(--dh-text)]">Resolución</h3>
      <dl class="mt-4 grid gap-4 text-sm md:grid-cols-2">
        <div><dt class="font-black text-[var(--dh-text-muted)]">Perfil</dt><dd class="mt-1 text-[var(--dh-text)]">{{ execution.profileName }} · {{ execution.profileKey }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Proveedor</dt><dd class="mt-1 text-[var(--dh-text)]">{{ providerLabel(execution.selectedProviderType) }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Conexión</dt><dd class="mt-1 text-[var(--dh-text)]">{{ execution.selectedConnectionName ?? '—' }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Modelo</dt><dd class="mt-1 text-[var(--dh-text)]">{{ execution.modelName ?? '—' }} · {{ execution.selectedExternalModelId ?? '—' }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Inicio</dt><dd class="mt-1 text-[var(--dh-text)]">{{ formatAiDate(execution.startedAtUtc) }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Fin</dt><dd class="mt-1 text-[var(--dh-text)]">{{ formatAiDate(execution.completedAtUtc) }}</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Tokens</dt><dd class="mt-1 text-[var(--dh-text)]">{{ execution.tokenUsage.inputTokens }} entrada · {{ execution.tokenUsage.outputTokens }} salida · {{ execution.tokenUsage.totalTokens }} total</dd></div>
        <div><dt class="font-black text-[var(--dh-text-muted)]">Finalización</dt><dd class="mt-1 text-[var(--dh-text)]">{{ execution.finishReason }}</dd></div>
      </dl>
    </section>

    <section v-if="execution.errorCode || execution.errorMessage" class="rounded-[26px] border border-red-500/25 bg-red-500/10 p-5">
      <h3 class="font-black text-red-600 dark:text-red-300">Error</h3>
      <p class="mt-2 text-sm font-black text-red-600 dark:text-red-300">{{ execution.errorCode }}</p>
      <p class="mt-1 whitespace-pre-wrap text-sm font-semibold text-red-700 dark:text-red-200">{{ execution.errorMessage }}</p>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <h3 class="font-black text-[var(--dh-text)]">Intentos y fallback</h3>
      <div class="mt-4 space-y-3">
        <article v-for="attempt in execution.attempts" :key="attempt.id" class="rounded-[20px] border border-[var(--dh-border)] p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="font-black text-[var(--dh-text)]">Intento #{{ attempt.attemptNumber }} · {{ attempt.modelName }}</p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ attempt.connectionName }} · {{ providerLabel(attempt.providerType) }} · {{ attempt.externalModelId }}</p>
            </div>
            <DhBadge :label="attempt.status" :variant="attempt.status === 'Completed' ? 'success' : attempt.status === 'Failed' ? 'danger' : 'neutral'" />
          </div>
          <div class="mt-3 grid gap-2 text-xs font-semibold text-[var(--dh-text-muted)] md:grid-cols-4">
            <span>{{ attempt.durationMilliseconds }} ms</span>
            <span>{{ attempt.tokenUsage.totalTokens }} tokens</span>
            <span>{{ formatAiCost(attempt.estimatedCost) }}</span>
            <span>{{ attempt.finishReason }}</span>
          </div>
          <p v-if="attempt.errorMessage" class="mt-3 whitespace-pre-wrap rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-300">{{ attempt.errorCode }} · {{ attempt.errorMessage }}</p>
        </article>
        <p v-if="!execution.attempts.length" class="py-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">No hay intentos registrados.</p>
      </div>
    </section>

    <div class="flex justify-end">
      <DhButton label="Cerrar" variant="secondary" @click="drawerStore.close()" />
    </div>
  </div>
</template>
