<script setup lang="ts">
import { X } from 'lucide-vue-next'

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
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <section
          class="dh-glass-strong dh-liquid max-h-[90vh] overflow-hidden rounded-[var(--dh-radius-xl)]"
          :class="[
            size === 'sm' && 'w-full max-w-sm',
            size === 'md' && 'w-full max-w-lg',
            size === 'lg' && 'w-full max-w-2xl',
            size === 'xl' && 'w-full max-w-5xl',
          ]"
        >
          <header
            class="flex items-center justify-between border-b border-[var(--dh-border)] px-5 py-4"
          >
            <h2 class="text-base font-bold text-[var(--dh-text)]">
              {{ title }}
            </h2>

            <button
              class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </header>

          <main class="max-h-[calc(90vh-65px)] overflow-y-auto p-5 dh-scrollbar">
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
