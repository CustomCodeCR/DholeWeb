<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useDrawerStore } from '@/core/stores/drawerStore'

const drawerStore = useDrawerStore()
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-backdrop">
      <div
        v-if="drawerStore.isOpen"
        class="fixed inset-0 z-[80] flex justify-end bg-black/35 backdrop-blur-sm"
        @click.self="drawerStore.close()"
      >
        <Transition name="drawer-panel" appear>
          <aside
            class="dh-glass-strong flex h-[100dvh] max-h-[100dvh] min-w-0 flex-col overflow-hidden border-l border-[var(--dh-border)] max-sm:border-l-0"
            :class="[
              drawerStore.size === 'sm' && 'w-full max-w-sm',
              drawerStore.size === 'md' && 'w-full max-w-xl',
              drawerStore.size === 'lg' && 'w-full max-w-3xl',
              drawerStore.size === 'xl' && 'w-full max-w-5xl',
              drawerStore.size === 'full' && 'w-full',
            ]"
          >
            <header
              class="flex min-h-16 min-w-0 shrink-0 items-center justify-between gap-3 border-b border-[var(--dh-border)] px-3 py-3 sm:px-5 sm:py-4"
            >
              <h2 class="min-w-0 flex-1 break-words text-sm font-bold text-[var(--dh-text)] sm:text-base">
                {{ drawerStore.title }}
              </h2>

              <button
                type="button"
                class="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl p-2 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                @click="drawerStore.close()"
              >
                <X class="h-4 w-4" />
              </button>
            </header>

            <main class="dh-scrollbar min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
              <component
                :is="drawerStore.component"
                v-if="drawerStore.component"
                v-bind="drawerStore.props"
              />
            </main>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop-enter-active,
.drawer-backdrop-leave-active,
.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition: all 220ms ease;
}

.drawer-backdrop-enter-from,
.drawer-backdrop-leave-to {
  opacity: 0;
}

.drawer-panel-enter-from,
.drawer-panel-leave-to {
  transform: translateX(100%);
}
</style>
