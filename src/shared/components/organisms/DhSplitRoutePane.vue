<script setup lang="ts">
import { computed, defineAsyncComponent, provide, type ComputedRef, type InjectionKey } from 'vue'
import { PanelTopClose } from 'lucide-vue-next'
import { routeLocationKey, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'

const props = defineProps<{
  path: string
  title: string
  titleKey?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const { t, te } = useI18n()

const resolvedRoute = computed(() => router.resolve(props.path))

provide(routeLocationKey as InjectionKey<ComputedRef<unknown>>, resolvedRoute as ComputedRef<unknown>)

const routeComponent = computed<Component | null>(() => {
  const matched = resolvedRoute.value.matched.at(-1)
  const component = matched?.components?.default

  if (!component) {
    return null
  }

  if (typeof component === 'function') {
    return defineAsyncComponent(component as any)
  }

  return component as Component
})

const paneTitle = computed(() => {
  if (props.titleKey && te(props.titleKey)) {
    return t(props.titleKey)
  }

  return props.title
})
</script>

<template>
  <section class="min-w-0 space-y-4 rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl">
    <header class="flex items-center justify-between gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-black text-[var(--dh-text)]">{{ paneTitle }}</h2>
      </div>

      <button
        type="button"
        class="rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
        :title="t('workspace.closeSplit')"
        @click="emit('close')"
      >
        <PanelTopClose class="h-4 w-4" />
      </button>
    </header>

    <div class="min-w-0 overflow-hidden rounded-[28px]">
      <component :is="routeComponent" v-if="routeComponent" :key="path" />
      <div v-else class="dh-glass rounded-[28px] p-6 text-sm font-bold text-[var(--dh-text-muted)]">
        {{ t('workspace.unavailableSplit') }}
      </div>
    </div>
  </section>
</template>
