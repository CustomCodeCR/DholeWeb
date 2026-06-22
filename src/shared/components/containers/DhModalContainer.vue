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
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        @click.self="modalStore.close()"
      >
        <Transition name="modal-panel" appear>
          <section
            class="dh-glass-strong dh-liquid max-h-[90vh] overflow-hidden rounded-[var(--dh-radius-xl)]"
            :class="[
              modalStore.size === 'sm' && 'w-full max-w-sm',
              modalStore.size === 'md' && 'w-full max-w-lg',
              modalStore.size === 'lg' && 'w-full max-w-2xl',
              modalStore.size === 'xl' && 'w-full max-w-4xl',
            ]"
          >
            <header
              class="flex items-center justify-between border-b border-[var(--dh-border)] px-5 py-4"
            >
              <h2 class="text-base font-bold text-[var(--dh-text)]">
                {{ modalStore.title }}
              </h2>

              <button
                type="button"
                class="rounded-2xl p-2 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                @click="modalStore.close()"
              >
                <X class="h-4 w-4" />
              </button>
            </header>

            <main class="max-h-[calc(90vh-65px)] overflow-y-auto p-5 dh-scrollbar">
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
