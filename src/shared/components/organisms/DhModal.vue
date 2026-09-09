<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
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
    <Transition name="modal-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-[90] flex min-w-0 items-end justify-center overflow-hidden bg-black/25 p-2 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <section
          role="dialog"
          aria-modal="true"
          :aria-label="title || t('common.dialog')"
          class="dh-glass-strong dh-liquid flex w-full min-w-0 flex-col overflow-hidden rounded-[26px] shadow-[var(--dh-shadow-lg)] max-sm:max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.5rem)] sm:max-h-[90dvh] sm:rounded-[var(--dh-radius-xl)]"
          :class="[
            size === 'sm' && 'max-w-sm',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            size === 'xl' && 'max-w-5xl',
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
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop-enter-active,
.modal-backdrop-leave-active {
  transition: all 200ms ease;
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
  opacity: 0;
}
</style>
