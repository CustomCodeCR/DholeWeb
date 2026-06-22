<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronDown } from 'lucide-vue-next'
export interface SidebarItem { label: string; path?: string; icon: Component; children?: SidebarItem[] }
defineProps<{ items: SidebarItem[] }>()
</script>
<template>
  <aside class="fixed bottom-4 left-4 top-4 z-40 w-72 overflow-hidden rounded-[34px] border border-[var(--dh-border)] bg-[var(--dh-shell)] shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl">
    <div class="border-b border-[var(--dh-border)] p-4">
      <div class="dh-liquid flex items-center gap-3 rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-[var(--dh-shadow-sm)]">
        <div class="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[var(--dh-primary)] text-lg font-black text-white shadow-[var(--dh-glow)]">D</div>
        <div><p class="text-sm font-black tracking-tight text-[var(--dh-text)]">Dhole</p><p class="text-xs font-semibold text-[var(--dh-text-muted)]">Operations Platform</p></div>
      </div>
    </div>
    <nav class="space-y-3 p-4">
      <template v-for="item in items" :key="item.label">
        <div v-if="item.children" class="space-y-1.5">
          <div class="flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--dh-text-muted)]">
            <component :is="item.icon" class="h-4 w-4" /><span>{{ item.label }}</span><ChevronDown class="ml-auto h-4 w-4" />
          </div>
          <RouterLink v-for="child in item.children" :key="child.path" :to="child.path ?? '/'" class="flex items-center gap-3 rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]">
            <component :is="child.icon" class="h-4 w-4" />{{ child.label }}
          </RouterLink>
        </div>
        <RouterLink v-else :to="item.path ?? '/'" class="flex items-center gap-3 rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]" active-class="!bg-[var(--dh-primary)] !text-white shadow-[var(--dh-glow)]">
          <component :is="item.icon" class="h-4 w-4" />{{ item.label }}
        </RouterLink>
      </template>
    </nav>
  </aside>
</template>
