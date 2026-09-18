<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhCard, DhTabs, type DhTabItem } from '@/shared/components/molecules'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import AiConsoleView from '@/modules/ai/views/AiConsoleView.vue'
import AiOperationsView from '@/modules/ai/views/AiOperationsView.vue'

const authStore = useAuthStore()
const { t } = useI18n()
const activeSection = ref('console')

const sections = computed<DhTabItem[]>(() => [
  { key: 'console', label: t('ai.center') },
  ...(authStore.hasScope(VIEW_SCOPES.aiExecutions)
    ? [{ key: 'operations', label: t('ai.queueOperations') }]
    : []),
])
</script>

<template>
  <section class="space-y-4">
    <DhCard padding="sm">
      <div class="mb-3 px-1">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">
          {{ t('ai.title') }}
        </p>
        <p class="mt-1 text-sm font-semibold leading-5 text-[var(--dh-text-muted)]">
          {{ t('ai.hubSubtitle') }}
        </p>
      </div>
      <div class="dh-scrollbar overflow-x-auto">
        <DhTabs v-model="activeSection" :items="sections" class="min-w-max" />
      </div>
    </DhCard>

    <AiConsoleView v-if="activeSection === 'console'" />
    <AiOperationsView v-else-if="activeSection === 'operations'" />
  </section>
</template>
