<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'

export interface SidebarItem {
  label: string
  path?: string
  icon: Component
  children?: SidebarItem[]
}

defineProps<{
  items: SidebarItem[]
  collapsed?: boolean
}>()

defineEmits<{
  'toggle-collapse': []
}>()

const { t } = useI18n()
</script>

<template>
  <aside
    class="fixed bottom-4 left-4 top-4 z-40 flex overflow-hidden rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl transition-[width] duration-300"
    :class="collapsed ? 'w-20' : 'w-72'"
  >
    <div class="flex min-h-0 w-full flex-col">
      <div class="shrink-0 border-b border-[var(--dh-border)] p-3">
        <div
          class="dh-liquid flex items-center rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)]"
          :class="collapsed ? 'justify-center' : 'gap-3'"
        >
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--dh-primary)] text-lg font-black text-white shadow-[var(--dh-glow)]"
          >
            GCF
          </div>

          <div v-if="!collapsed" class="min-w-0">
            <p class="truncate text-sm font-black tracking-tight text-[var(--dh-text)]">
              {{ t('app.name') }}
            </p>
            <p class="truncate text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ t('app.subtitle') }}
            </p>
          </div>
        </div>

        <button
          class="mt-3 flex w-full items-center justify-center rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
          :title="collapsed ? t('sidebar.expand') : t('sidebar.collapse')"
          @click="$emit('toggle-collapse')"
        >
          <PanelLeftOpen v-if="collapsed" class="h-4 w-4" />
          <PanelLeftClose v-else class="h-4 w-4" />
        </button>
      </div>

      <nav
        class="dh-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pr-2"
      >
        <template v-for="item in items" :key="item.label">
          <div v-if="item.children" class="space-y-1.5">
            <div
              class="flex items-center rounded-[20px] px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--dh-text-muted)]"
              :class="collapsed ? 'justify-center' : 'gap-3'"
              :title="collapsed ? item.label : undefined"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />

              <span v-if="!collapsed" class="truncate">
                {{ item.label }}
              </span>

              <ChevronDown v-if="!collapsed" class="ml-auto h-4 w-4 shrink-0" />
            </div>

            <RouterLink
              v-for="child in item.children"
              :key="child.path"
              :to="child.path ?? '/'"
              class="flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"
              :class="collapsed ? 'justify-center' : 'gap-3'"
              :title="collapsed ? child.label : undefined"
              active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]"
            >
              <component :is="child.icon" class="h-4 w-4 shrink-0" />

              <span v-if="!collapsed" class="truncate">
                {{ child.label }}
              </span>
            </RouterLink>
          </div>

          <RouterLink
            v-else
            :to="item.path ?? '/'"
            class="flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"
            :class="collapsed ? 'justify-center' : 'gap-3'"
            :title="collapsed ? item.label : undefined"
            active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" />

            <span v-if="!collapsed" class="truncate">
              {{ item.label }}
            </span>
          </RouterLink>
        </template>
      </nav>
    </div>
  </aside>
</template>
