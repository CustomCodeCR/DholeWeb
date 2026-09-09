<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  }>(),
  {
    size: 'md',
  },
)

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex min-w-0 items-end justify-end overflow-hidden bg-black/20 backdrop-blur-sm sm:items-stretch"
        @click.self="emit('close')"
      >
        <aside
          role="dialog"
          aria-modal="true"
          :aria-label="title || 'Panel lateral'"
          class="dh-glass-strong flex h-[calc(100dvh-0.5rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] border border-[var(--dh-border)] shadow-[var(--dh-shadow-lg)] sm:h-full sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l"
          :class="[
            size === 'sm' && 'max-w-sm',
            size === 'md' && 'max-w-xl',
            size === 'lg' && 'max-w-3xl',
            size === 'xl' && 'max-w-5xl',
            size === 'full' && 'max-w-none',
          ]"
        >
          <header
            class="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3 sm:px-5 sm:py-4"
          >
            <h2 class="min-w-0 break-words text-base font-bold text-[var(--dh-text)]">
              {{ title }}
            </h2>

            <button
              class="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10 sm:min-h-9 sm:min-w-9"
              :aria-label="t('common.close')"
              :title="t('common.close')"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </header>

          <main class="dh-scrollbar min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
            <slot />
          </main>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active {
  transition: all 220ms ease;
}

.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}
</style>
