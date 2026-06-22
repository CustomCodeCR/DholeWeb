<script setup lang="ts">
import { X } from 'lucide-vue-next'

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
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <aside
          class="dh-glass-strong h-full overflow-hidden border-l border-[var(--dh-border)]"
          :class="[
            size === 'sm' && 'w-full max-w-sm',
            size === 'md' && 'w-full max-w-xl',
            size === 'lg' && 'w-full max-w-3xl',
            size === 'xl' && 'w-full max-w-5xl',
            size === 'full' && 'w-full',
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

          <main class="h-[calc(100vh-65px)] overflow-y-auto p-5 dh-scrollbar">
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
