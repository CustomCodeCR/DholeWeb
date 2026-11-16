<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    open: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    priority?: boolean
    surface?: 'glass' | 'solid'
  }>(),
  {
    size: 'md',
    priority: false,
    surface: 'glass',
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
        data-dh-overlay="modal"
        class="fixed inset-0 flex items-center justify-center p-2 backdrop-blur-sm sm:p-4"
        :class="priority ? 'z-[110] bg-black/60' : 'z-[90] bg-black/45'"
        @click.self="emit('close')"
      >
        <section
          role="dialog"
          aria-modal="true"
          :aria-label="title || t('common.dialog')"
          :data-dh-modal-surface="surface"
          class="flex min-h-0 min-w-0 flex-col max-h-[calc(100dvh-1rem)] overflow-hidden rounded-[22px] sm:max-h-[90vh] sm:rounded-[var(--dh-radius-xl)]"
          :class="[
            surface === 'solid'
              ? 'border border-[var(--dh-border-strong)] bg-[var(--dh-card-solid)] shadow-[var(--dh-shadow-lg)]'
              : 'dh-glass-strong dh-liquid',
            size === 'sm' && 'w-full max-w-sm',
            size === 'md' && 'w-full max-w-lg',
            size === 'lg' && 'w-full max-w-2xl',
            size === 'xl' && 'w-full max-w-5xl',
          ]"
        >
          <header
            class="flex min-h-14 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--dh-border)] px-3 py-2 sm:px-5 sm:py-4"
          >
            <h2 class="min-w-0 flex-1 break-words text-sm font-bold text-[var(--dh-text)] sm:text-base">
              {{ title }}
            </h2>

            <button
              type="button"
              class="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
              :aria-label="t('common.close')"
              :title="t('common.close')"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </header>

          <main class="dh-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-5">
            <slot />
          </main>
          <footer v-if="$slots.footer" class="min-w-0 shrink-0 border-t border-[var(--dh-border)] bg-[var(--dh-card-solid)] px-3 py-3 sm:px-5">
            <slot name="footer" />
          </footer>
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
