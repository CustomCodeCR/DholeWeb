<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Layers3, PanelRightOpen, Trash2, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { translateUiText } from '@/core/i18n/uiTextBridge'
import { useRouter } from 'vue-router'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { visibleWorkspaceTabKeys } from '@/core/stores/workspaceTabPolicy'

const router = useRouter()
const tabsStore = useWorkspaceTabsStore()
const { t, locale } = useI18n()
const tabListRef = ref<HTMLElement | null>(null)
const menuRootRef = ref<HTMLElement | null>(null)
const overflowOpen = ref(false)
const visibleTabs = computed(() => {
  const visibleKeys = visibleWorkspaceTabKeys(tabsStore.tabs, tabsStore.activeKey)
  return tabsStore.tabs.filter((tab) => visibleKeys.has(tab.key))
})
const hiddenTabs = computed(() => {
  const visibleKeys = new Set(visibleTabs.value.map((tab) => tab.key))
  return tabsStore.tabs.filter((tab) => !visibleKeys.has(tab.key))
})

watch(() => hiddenTabs.value.length, (count) => {
  if (!count) overflowOpen.value = false
})

function handleOutsidePointerDown(event: PointerEvent) {
  if (menuRootRef.value && !menuRootRef.value.contains(event.target as Node)) {
    overflowOpen.value = false
  }
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointerDown))

watch(
  () => tabsStore.activeKey,
  async () => {
    await nextTick()
    const active = tabListRef.value?.querySelector<HTMLElement>('[aria-selected="true"]')
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  },
  { flush: 'post', immediate: true },
)

function displayTitle(tab: { title: string; titleKey?: string }): string {
  if (tab.titleKey) return t(tab.titleKey)
  return translateUiText(tab.title, locale.value === 'en' ? 'en' : 'es')
}

function activate(path: string, key: string) {
  overflowOpen.value = false
  tabsStore.setActiveTab(key)
  router.push(tabsStore.activeTab?.path ?? path)
}

function close(key: string) {
  overflowOpen.value = false
  const wasActive = tabsStore.activeKey === key
  tabsStore.closeTab(key)

  if (wasActive) {
    router.push(tabsStore.activeTab?.path ?? '/home')
  }
}

function closeAll() {
  overflowOpen.value = false
  tabsStore.clear()
  router.replace('/home')
}

function split(key: string) {
  const wasActive = tabsStore.activeKey === key
  tabsStore.openSplitPane(key)

  if (wasActive) {
    router.push(tabsStore.activeTab?.path ?? '/home')
  }
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
    class="mx-2 mt-2 flex max-w-[calc(100vw-1rem)] min-w-0 items-center gap-1.5 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-1.5 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl sm:mx-4 sm:mt-4 sm:max-w-[calc(100vw-2rem)] sm:gap-2 sm:rounded-[26px] sm:p-2"
  >
    <div
      ref="tabListRef"
      role="tablist"
      :aria-label="t('tabs.workspaceTabs')"
      class="dh-responsive-tabs dh-scrollbar flex min-w-0 flex-1 snap-x snap-proximity items-center gap-1.5 overflow-x-auto sm:gap-2"
    >
    <div
      v-for="tab in visibleTabs"
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

    <div ref="menuRootRef" class="relative flex shrink-0 items-center gap-1">
      <button
        v-if="hiddenTabs.length"
        type="button"
        class="inline-flex min-h-9 items-center gap-1 rounded-xl border border-[var(--dh-border)] px-2 text-xs font-bold text-[var(--dh-text)] transition hover:bg-[var(--dh-card-hover)]"
        :aria-expanded="overflowOpen"
        aria-haspopup="true"
        :title="`Ver ${hiddenTabs.length} pestañas adicionales`"
        @click="overflowOpen = !overflowOpen"
        @keydown.esc.stop="overflowOpen = false"
      >
        <Layers3 class="h-4 w-4" />
        <span class="hidden sm:inline">Más</span>
        <span>{{ hiddenTabs.length }}</span>
      </button>

      <div
        v-if="overflowOpen && hiddenTabs.length"
        class="absolute right-0 top-full z-50 mt-2 max-h-80 w-[min(80vw,20rem)] overflow-y-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-xl backdrop-blur-2xl"
        @keydown.esc.stop="overflowOpen = false"
      >
        <p class="px-2 py-1 text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Otras pestañas</p>
        <div v-for="tab in hiddenTabs" :key="tab.key" class="flex items-center gap-1 rounded-xl hover:bg-[var(--dh-card-hover)]">
          <button
            type="button"
            class="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm font-semibold text-[var(--dh-text)]"
            :title="displayTitle(tab)"
            @click="activate(tab.path, tab.key)"
          >
            {{ displayTitle(tab) }}
          </button>
          <button
            v-if="tab.closable"
            type="button"
            class="shrink-0 rounded-lg p-2 text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]"
            :aria-label="`Cerrar ${displayTitle(tab)}`"
            @click="close(tab.key)"
          ><X class="h-4 w-4" /></button>
        </div>
      </div>

      <button
        v-if="tabsStore.tabs.length > 1"
        type="button"
        class="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
        title="Cerrar todas las pestañas (Ctrl+Alt+W)"
        aria-label="Cerrar todas las pestañas"
        @click="closeAll"
      >
        <Trash2 class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
