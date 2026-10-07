<script setup lang="ts">
import { PanelRightOpen, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { translateUiText } from '@/core/i18n/uiTextBridge'
import { useRouter } from 'vue-router'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'

const router = useRouter()
const tabsStore = useWorkspaceTabsStore()
const { t, locale } = useI18n()

function displayTitle(tab: { title: string; titleKey?: string }): string {
  if (tab.titleKey) return t(tab.titleKey)
  return translateUiText(tab.title, locale.value === 'en' ? 'en' : 'es')
}

function activate(path: string, key: string) {
  tabsStore.setActiveTab(key)
  router.push(tabsStore.activeTab?.path ?? path)
}

function close(key: string) {
  const wasActive = tabsStore.activeKey === key
  tabsStore.closeTab(key)

  if (wasActive) {
    router.push(tabsStore.activeTab?.path ?? '/home')
  }
}

function split(key: string) {
  tabsStore.openSplitPane(key)
}

function onAuxClick(event: MouseEvent, key: string, closable: boolean) {
  if (event.button !== 1 || !closable) return
  event.preventDefault()
  close(key)
}

function readDraggedTabKey(event: DragEvent): string | null {
  return (
    event.dataTransfer?.getData('application/dhole-tab-key')
    || event.dataTransfer?.getData('text/plain')
    || null
  )
}

function onDragStart(event: DragEvent, key: string) {
  event.dataTransfer?.setData('application/dhole-tab-key', key)
  event.dataTransfer?.setData('text/plain', key)

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onTabDrop(event: DragEvent, targetKey: string) {
  event.preventDefault()
  event.stopPropagation()

  const sourceKey = readDraggedTabKey(event)
  if (!sourceKey) return

  tabsStore.reorderTab(sourceKey, targetKey)
}
</script>

<template>
  <div
    v-if="tabsStore.tabs.length"
    role="tablist"
    :aria-label="t('tabs.workspaceTabs')"
    class="dh-responsive-tabs dh-scrollbar mx-2 mt-2 flex max-w-[calc(100vw-1rem)] min-w-0 snap-x snap-proximity gap-1.5 overflow-x-auto rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-1.5 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl sm:mx-4 sm:mt-4 sm:max-w-[calc(100vw-2rem)] sm:gap-2 sm:rounded-[26px] sm:p-2"
  >
    <div
      v-for="tab in tabsStore.tabs"
      :key="tab.key"
      role="tab"
      tabindex="0"
      draggable="true"
      :aria-selected="tabsStore.activeKey === tab.key"
      :data-workspace-tab="tab.key"
      class="group flex min-h-10 max-w-[min(76vw,22rem)] shrink-0 cursor-pointer touch-manipulation snap-start items-center gap-1.5 rounded-[16px] border border-transparent px-2.5 py-1.5 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--dh-primary)] sm:min-h-11 sm:max-w-[28rem] sm:gap-2 sm:rounded-[18px] sm:px-3 sm:py-2 sm:text-sm"
      :class="[
        tabsStore.activeKey === tab.key
          ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]'
          : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]',
        tabsStore.splitPane?.key === tab.key
          ? 'border-[rgb(var(--dh-primary-rgb)/0.55)] ring-1 ring-[rgb(var(--dh-primary-rgb)/0.22)]'
          : '',
      ]"
      @click="activate(tab.path, tab.key)"
      @keydown.enter.prevent="activate(tab.path, tab.key)"
      @keydown.space.prevent="activate(tab.path, tab.key)"
      @auxclick="onAuxClick($event, tab.key, tab.closable)"
      @dragstart="onDragStart($event, tab.key)"
      @dragover.prevent
      @drop="onTabDrop($event, tab.key)"
    >
      <span class="min-w-0 truncate">{{ displayTitle(tab) }}</span>

      <button
        v-if="tab.path !== '/home'"
        type="button"
        class="hidden h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-lg transition lg:inline-flex"
        :class="
          tabsStore.splitPane?.key === tab.key
            ? 'bg-[rgb(var(--dh-primary-rgb)/0.16)] text-[var(--dh-primary)] opacity-100'
            : 'opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10'
        "
        :title="tabsStore.splitPane?.key === tab.key ? t('tabs.closeSplit') : t('tabs.openSplit')"
        :aria-label="tabsStore.splitPane?.key === tab.key ? t('tabs.closeSplit') : t('tabs.openSplit')"
        @click.stop="split(tab.key)"
      >
        <PanelRightOpen class="h-3.5 w-3.5" />
      </button>

      <button
        v-if="tab.closable"
        type="button"
        class="inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-lg opacity-65 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 sm:h-7 sm:w-7"
        :title="t('tabs.close')"
        :aria-label="t('tabs.close')"
        @click.stop="close(tab.key)"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
