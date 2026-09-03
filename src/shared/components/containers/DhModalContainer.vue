<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useModalStore } from '@/core/stores/modalStore'

const modalStore = useModalStore()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div
        v-if="modalStore.isOpen"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm sm:p-4"
        @click.self="modalStore.close()"
      >
        <Transition name="modal-panel" appear>
          <section
            class="dh-glass-strong dh-liquid flex max-h-[calc(100dvh-1rem)] min-w-0 flex-col overflow-hidden rounded-[22px] sm:max-h-[90vh] sm:rounded-[var(--dh-radius-xl)]"
            :class="[
              modalStore.size === 'sm' && 'w-full max-w-sm',
              modalStore.size === 'md' && 'w-full max-w-lg',
              modalStore.size === 'lg' && 'w-full max-w-2xl',
              modalStore.size === 'xl' && 'w-full max-w-4xl',
            ]"
          >
            <header
              class="flex min-h-16 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--dh-border)] px-3 py-3 sm:px-5 sm:py-4"
            >
              <h2 class="min-w-0 flex-1 break-words text-sm font-bold text-[var(--dh-text)] sm:text-base">
                {{ modalStore.title }}
              </h2>

              <button
                type="button"
                class="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl p-2 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                @click="modalStore.close()"
              >
                <X class="h-4 w-4" />
              </button>
            </header>

            <main class="dh-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
              <component
                :is="modalStore.component"
                v-if="modalStore.component"
                v-bind="modalStore.props"
              />
            </main>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop-enter-active,
.modal-backdrop-leave-active,
.modal-panel-enter-active,
.modal-panel-leave-active {
  transition: all 200ms ease;
}

.modal-backdrop-enter-from,
.modal-backdrop-leave-to {
  opacity: 0;
}

.modal-panel-enter-from,
.modal-panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
</style>
