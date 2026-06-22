<script setup lang="ts">
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import { useToastStore, type ToastType } from '@/core/stores/toastStore'

const toastStore = useToastStore()

function iconByType(type: ToastType) {
  if (type === 'success') return CheckCircle
  if (type === 'error') return AlertCircle
  if (type === 'warning') return AlertTriangle
  return Info
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed right-5 top-5 z-[100] flex w-[360px] flex-col gap-3">
      <TransitionGroup name="toast">
        <article
          v-for="toast in toastStore.items"
          :key="toast.id"
          class="dh-glass-strong dh-liquid rounded-[var(--dh-radius-lg)] p-4"
        >
          <div class="flex gap-3">
            <component
              :is="iconByType(toast.type)"
              class="mt-0.5 h-5 w-5 shrink-0"
              :class="[
                toast.type === 'success' && 'text-green-500',
                toast.type === 'error' && 'text-red-500',
                toast.type === 'warning' && 'text-yellow-500',
                toast.type === 'info' && 'text-[var(--dh-primary)]',
              ]"
            />

            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-bold text-[var(--dh-text)]">
                {{ toast.title }}
              </h4>

              <p v-if="toast.message" class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">
                {{ toast.message }}
              </p>
            </div>

            <button
              type="button"
              class="rounded-xl p-1 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
              @click="toastStore.remove(toast.id)"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </article>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px) scale(0.98);
}
</style>
