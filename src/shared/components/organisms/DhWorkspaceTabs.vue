<script setup lang="ts">
import { PanelRightOpen, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'

const router = useRouter()
const tabsStore = useWorkspaceTabsStore()
const { t } = useI18n()

function activate(path: string, key: string) {
  tabsStore.setActiveTab(key)
  router.push(path)
}

function close(key: string) {
  const wasActive = tabsStore.activeKey === key
  tabsStore.closeTab(key)

  if (wasActive) {
    const active = tabsStore.tabs.find((x) => x.key === tabsStore.activeKey)
    router.push(active?.path ?? '/home')
  }
}

function split(key: string) {
  tabsStore.openSplitPane(key)
}

function onDragStart(event: DragEvent, key: string) {
  event.dataTransfer?.setData('application/dhole-tab-key', key)
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}
</script>

<template>
  <div
    v-if="tabsStore.tabs.length"
    role="tablist"
    class="dh-responsive-tabs dh-scrollbar mx-2 mt-2 flex max-w-[calc(100vw-1rem)] min-w-0 snap-x snap-proximity gap-2 overflow-x-auto rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl sm:mx-4 sm:mt-4 sm:max-w-[calc(100vw-2rem)] sm:rounded-[26px]"
  >
    <button
      v-for="tab in tabsStore.tabs"
      :key="tab.key"
      role="tab"
      :aria-selected="tabsStore.activeKey === tab.key"
      draggable="true"
      class="group flex min-h-11 max-w-[min(78vw,24rem)] shrink-0 touch-manipulation snap-start items-center gap-2 rounded-[18px] px-3 py-2 text-xs font-black transition sm:max-w-[28rem] sm:text-sm"
      :class="
        tabsStore.activeKey === tab.key
          ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]'
          : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]'
      "
      @click="activate(tab.path, tab.key)"
      @dragstart="onDragStart($event, tab.key)"
    >
      <span class="min-w-0 truncate">{{ tab.title }}</span>

      <span
        v-if="tab.path !== '/home'"
        class="hidden shrink-0 touch-manipulation items-center justify-center rounded-lg opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 lg:inline-flex lg:p-0.5"
        :title="t('tabs.openSplit')"
        @click.stop="split(tab.key)"
      >
        <PanelRightOpen class="h-3.5 w-3.5" />
      </span>

      <span
        v-if="tab.closable"
        class="inline-flex min-h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 sm:min-h-0 sm:min-w-0 sm:p-0.5"
        :title="t('tabs.close')"
        @click.stop="close(tab.key)"
      >
        <X class="h-3.5 w-3.5" />
      </span>
    </button>
  </div>
</template>
