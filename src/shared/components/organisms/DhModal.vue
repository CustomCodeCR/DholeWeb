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
        class="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <section
          class="dh-glass-strong dh-liquid max-h-[calc(100dvh-1rem)] overflow-hidden rounded-[26px] sm:max-h-[90vh] sm:rounded-[var(--dh-radius-xl)]"
          :class="[
            size === 'sm' && 'w-full max-w-sm',
            size === 'md' && 'w-full max-w-lg',
            size === 'lg' && 'w-full max-w-2xl',
            size === 'xl' && 'w-full max-w-5xl',
          ]"
        >
          <header
            class="flex items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3 sm:px-5 sm:py-4"
          >
            <h2 class="text-base font-bold text-[var(--dh-text)]">
              {{ title }}
            </h2>

            <button
              class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
              :aria-label="t('common.close')"
              :title="t('common.close')"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </header>

          <main class="max-h-[calc(100dvh-62px)] overflow-y-auto p-3 sm:max-h-[calc(90vh-65px)] sm:p-5 dh-scrollbar">
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
