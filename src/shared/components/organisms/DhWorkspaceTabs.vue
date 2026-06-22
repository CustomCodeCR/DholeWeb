<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
const router = useRouter()
const tabsStore = useWorkspaceTabsStore()
function activate(path: string, key: string) { tabsStore.setActiveTab(key); router.push(path) }
function close(key: string) { const wasActive = tabsStore.activeKey === key; tabsStore.closeTab(key); if (wasActive) { const active = tabsStore.tabs.find((x) => x.key === tabsStore.activeKey); router.push(active?.path ?? '/home') } }
</script>
<template>
  <div v-if="tabsStore.tabs.length" class="mx-4 mt-4 flex gap-2 overflow-x-auto rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl dh-scrollbar">
    <button v-for="tab in tabsStore.tabs" :key="tab.key" class="flex shrink-0 items-center gap-2 rounded-[18px] px-3 py-2 text-sm font-black transition" :class="tabsStore.activeKey === tab.key ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]' : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]'" @click="activate(tab.path, tab.key)">
      {{ tab.title }}
      <span v-if="tab.closable" class="rounded-lg p-0.5 hover:bg-black/10 dark:hover:bg-white/10" @click.stop="close(tab.key)"><X class="h-3.5 w-3.5" /></span>
    </button>
  </div>
</template>
