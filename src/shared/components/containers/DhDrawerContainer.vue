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
            class="dh-glass-strong h-full overflow-hidden border-l border-[var(--dh-border)]"
            :class="[
              drawerStore.size === 'sm' && 'w-full max-w-sm',
              drawerStore.size === 'md' && 'w-full max-w-xl',
              drawerStore.size === 'lg' && 'w-full max-w-3xl',
              drawerStore.size === 'xl' && 'w-full max-w-5xl',
              drawerStore.size === 'full' && 'w-full',
            ]"
          >
            <header
              class="flex items-center justify-between border-b border-[var(--dh-border)] px-5 py-4"
            >
              <h2 class="text-base font-bold text-[var(--dh-text)]">
                {{ drawerStore.title }}
              </h2>

              <button
                type="button"
                class="rounded-2xl p-2 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                @click="drawerStore.close()"
              >
                <X class="h-4 w-4" />
              </button>
            </header>

            <main class="h-[calc(100vh-65px)] overflow-y-auto p-5 dh-scrollbar">
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
