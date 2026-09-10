<script setup lang="ts">
import { computed, ref } from 'vue'
import { Activity, BrainCircuit } from 'lucide-vue-next'
import { DhTabs } from '@/shared/components/molecules'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import AiConsoleView from '@/modules/ai/views/AiConsoleView.vue'
import AiOperationsView from '@/modules/ai/views/AiOperationsView.vue'

const authStore = useAuthStore()
const activeSection = ref<'console' | 'operations'>('console')

const sections = computed(() => [
  { key: 'console', label: 'Centro de IA', icon: BrainCircuit },
  ...(authStore.hasScope(VIEW_SCOPES.aiExecutions)
    ? [{ key: 'operations', label: 'Cola y operaciones', icon: Activity }]
    : []),
])
</script>

<template>
  <section class="space-y-4">
    <div class="dh-glass dh-liquid rounded-[24px] p-3 sm:p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Inteligencia artificial</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Administración, historial y estado operativo de la cola de IA.</p>
        </div>
      </div>
      <div class="dh-scrollbar overflow-x-auto">
        <DhTabs v-model="activeSection" :items="sections" class="min-w-max" />
      </div>
    </div>

    <AiConsoleView v-if="activeSection === 'console'" />
    <AiOperationsView v-else-if="activeSection === 'operations'" />
  </section>
</template>
