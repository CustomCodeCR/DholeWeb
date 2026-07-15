<script setup lang="ts">
import {
  Activity,
  BadgeDollarSign,
  BookOpen,
  ClipboardList,
  Home,
  KeyRound,
  Keyboard,
  ListTree,
  LockKeyhole,
  MonitorCheck,
  Palette,
  PanelRightClose,
  ServerCog,
  TrendingUp,
  Settings,
  Shield,
  Users,
  FileText,
  Mail,
  ReceiptText,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DhSidebar, { type SidebarItem } from '@/shared/components/organisms/DhSidebar.vue'
import DhTopbar from '@/shared/components/organisms/DhTopbar.vue'
import DhWorkspaceTabs from '@/shared/components/organisms/DhWorkspaceTabs.vue'
import DhCommandPalette, {
  type CommandItem,
} from '@/shared/components/organisms/DhCommandPalette.vue'
import { VIEW_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useShortcutStore, eventToShortcut } from '@/core/stores/shortcutStore'
import { useThemeStore } from '@/core/stores/themeStore'
import { useLocale } from '@/core/stores/locale'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'dhole.sidebar.collapsed'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const shortcutStore = useShortcutStore()
const themeStore = useThemeStore()
const localeStore = useLocale()
const tabsStore = useWorkspaceTabsStore()

const commandOpen = ref(false)
const commandQuery = ref('')

const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
const isEmbedded = new URLSearchParams(window.location.search).get('dhEmbed') === '1'

const contentClass = computed(() => {
  return sidebarCollapsed.value ? 'pl-28' : 'pl-80'
})

const splitFrameUrl = computed(() => {
  if (!tabsStore.splitPane) return ''
  return `${window.location.origin}${tabsStore.splitPane.path}?dhEmbed=1`
})

watch(sidebarCollapsed, (value) => {
  localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value))
})

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function canView(scope: string): boolean {
  return authStore.hasScope(scope)
}

function isSuperUser(): boolean {
  return authStore.hasRole('SuperUsuario') || authStore.hasRole('SuperUser') || authStore.hasRole('superusuario')
}

const securityChildren = computed<SidebarItem[]>(() => {
  const children: SidebarItem[] = []

  if (canView(VIEW_SCOPES.users)) {
    children.push({ label: t('sidebar.users'), path: '/auth/users', icon: Users })
  }

  if (canView(VIEW_SCOPES.roles)) {
    children.push({ label: t('sidebar.roles'), path: '/auth/roles', icon: Shield })
  }

  if (canView(VIEW_SCOPES.scopes)) {
    children.push({ label: t('sidebar.scopes'), path: '/auth/scopes', icon: KeyRound })
  }

  if (canView(VIEW_SCOPES.sessions)) {
    children.push({ label: t('sidebar.sessions'), path: '/auth/sessions', icon: MonitorCheck })
  }

  return children
})

const configChildren = computed<SidebarItem[]>(() => {
  const children: SidebarItem[] = []

  if (canView(VIEW_SCOPES.catalogs)) {
    children.push({ label: t('sidebar.catalogs'), path: '/config/catalogs', icon: ListTree })
  }

  return children
})

const pricingChildren = computed<SidebarItem[]>(() => {
  const children: SidebarItem[] = []

  const canOpenPricing =
    canView(VIEW_SCOPES.pricing) ||
    canView(VIEW_SCOPES.pricingRates) ||
    canView(VIEW_SCOPES.pricingImports) ||
    canView(VIEW_SCOPES.pricingDecisions) ||
    canView(VIEW_SCOPES.pricingCosts)

  if (canOpenPricing) {
    children.push({ label: t('sidebar.pricingPanel'), path: '/pricing', icon: TrendingUp })
  }

  if (canView(VIEW_SCOPES.pricingImports)) {
    children.push({ label: t('sidebar.importedRates'), path: '/pricing/imports', icon: FileText })
    children.push({
      label: t('sidebar.emailImports'),
      path: '/pricing/email-imports',
      icon: Mail,
    })
  }

  if (canView(VIEW_SCOPES.pricingRates)) {
    children.push({ label: t('sidebar.rates'), path: '/pricing/rates', icon: ReceiptText })
  }

  if (canView(VIEW_SCOPES.pricingCosts)) {
    children.push({ label: t('sidebar.costs'), path: '/pricing/costs', icon: BadgeDollarSign })
  }

  return children
})

const monitoringChildren = computed<SidebarItem[]>(() => {
  const children: SidebarItem[] = []

  if (canView(VIEW_SCOPES.auditLogs)) {
    children.push({
      label: t('sidebar.audits'),
      path: '/auditlogs/events',
      icon: ClipboardList,
    })
  }

  if (isSuperUser()) {
    children.push({
      label: t('sidebar.serviceMonitoring'),
      path: '/monitoring/services',
      icon: ServerCog,
    })
  }

  return children
})

const sidebarItems = computed<SidebarItem[]>(() => {
  const items: SidebarItem[] = [
    {
      label: t('sidebar.dashboard'),
      path: '/home',
      icon: Home,
    },
  ]

  if (securityChildren.value.length > 0) {
    items.push({ label: t('sidebar.security'), icon: LockKeyhole, children: securityChildren.value })
  }

  if (configChildren.value.length > 0) {
    items.push({ label: t('sidebar.config'), icon: BookOpen, children: configChildren.value })
  }

  if (pricingChildren.value.length > 0) {
    items.push({ label: t('sidebar.pricing'), icon: TrendingUp, children: pricingChildren.value })
  }

  if (monitoringChildren.value.length > 0) {
    items.push({
      label: t('sidebar.monitoring'),
      icon: ServerCog,
      children: monitoringChildren.value,
    })
  }

  items.push({
    label: t('sidebar.settings'),
    icon: Settings,
    children: [
      { label: t('sidebar.appearance'), path: '/settings/appearance', icon: Palette },
      { label: t('sidebar.shortcuts'), path: '/settings/shortcuts', icon: Keyboard },
    ],
  })

  return items
})

const commands = computed<CommandItem[]>(() => {
  const result: CommandItem[] = []

  for (const item of sidebarItems.value) {
    if (item.path) {
      result.push({ id: item.path, title: item.label, description: item.path, icon: item.icon })
    }

    for (const child of item.children ?? []) {
      if (!child.path) continue
      result.push({ id: child.path, title: child.label, description: child.path, icon: child.icon })
    }
  }

  return result
})

const filteredCommands = computed(() => {
  const query = commandQuery.value.trim().toLowerCase()

  if (!query) return commands.value

  return commands.value.filter((item) =>
    `${item.title} ${item.description ?? ''}`.toLowerCase().includes(query),
  )
})

function selectCommand(item: CommandItem) {
  commandOpen.value = false
  commandQuery.value = ''
  router.push(item.id)
}

function logout() {
  authStore.clearSession()
  tabsStore.clear()
  router.push('/login')
}

function closeCurrentTab() {
  if (!tabsStore.activeKey) return

  const activeTab = tabsStore.tabs.find((tab) => tab.key === tabsStore.activeKey)

  if (!activeTab || activeTab.closable === false) return

  const key = tabsStore.activeKey

  tabsStore.closeTab(key)

  const active = tabsStore.tabs.find((x) => x.key === tabsStore.activeKey)

  router.push(active?.path ?? '/home')
}


const activePaneTitle = computed(() => tabsStore.activeTab?.title ?? t('sidebar.dashboard'))

function readDraggedTabKey(event: DragEvent): string | null {
  return (
    event.dataTransfer?.getData('application/dhole-tab-key') ||
    event.dataTransfer?.getData('text/plain') ||
    null
  )
}

function handlePaneDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function dropTabToMain(event: DragEvent) {
  event.preventDefault()
  const key = readDraggedTabKey(event)
  if (!key) return

  const tab = tabsStore.moveTabToMain(key)
  if (tab) {
    router.push(tab.path)
  }
}

function dropTabToSplit(event: DragEvent) {
  event.preventDefault()
  const key = readDraggedTabKey(event)
  if (!key) return

  tabsStore.openSplitPane(key)
}

function closeMainPane() {
  const activeTab = tabsStore.activeTab

  if (activeTab?.closable) {
    tabsStore.closeTab(activeTab.key)
  }

  const promoted = tabsStore.promoteSplitPaneToMain()
  const next = promoted ?? tabsStore.activeTab

  router.push(next?.path ?? '/home')
}

function dispatchShortcut(name: string) {
  window.dispatchEvent(new CustomEvent(name))
}

function isShortcutRecorderTarget(event: KeyboardEvent): boolean {
  const target = event.target

  return (
    target instanceof Element && Boolean(target.closest('[data-dhole-shortcut-recorder="true"]'))
  )
}

function handleShortcut(event: KeyboardEvent) {
  if (isShortcutRecorderTarget(event)) return

  const keys = eventToShortcut(event)
  const shortcut = shortcutStore.byKeys(keys)

  if (!shortcut) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  if (shortcut.action === 'global.search') {
    commandOpen.value = true
    return
  }

  if (shortcut.action === 'record.create') {
    dispatchShortcut('dhole:create')
    return
  }

  if (shortcut.action === 'record.save') {
    dispatchShortcut('dhole:save')
    return
  }

  if (shortcut.action === 'tab.close') {
    closeCurrentTab()
    return
  }

  if (shortcut.action === 'theme.toggle') {
    themeStore.toggleTheme()
    return
  }

  if (shortcut.action === 'locale.toggle') {
    localeStore.toggleLocale()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut, { capture: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut, { capture: true })
})
</script>

<template>
  <div v-if="isEmbedded" class="min-h-screen p-4">
    <RouterView />
  </div>

  <div v-else class="min-h-screen">
    <DhSidebar
      :items="sidebarItems"
      :collapsed="sidebarCollapsed"
      @toggle-collapse="toggleSidebar"
    />

    <div class="min-h-screen pr-4 transition-[padding] duration-300" :class="contentClass">
      <DhTopbar @search="commandOpen = true" @logout="logout" />
      <DhWorkspaceTabs />

      <main class="p-4">
        <div v-if="tabsStore.splitPane && !isEmbedded" class="grid gap-4 xl:grid-cols-2">
          <section
            class="dh-glass dh-liquid min-h-[calc(100vh-10rem)] overflow-hidden rounded-[32px]"
            @dragover="handlePaneDragOver"
            @drop="dropTabToMain"
          >
            <div class="flex items-center justify-between border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3">
              <h2 class="truncate text-sm font-black text-[var(--dh-text)]">{{ activePaneTitle }}</h2>

              <button
                class="rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
                :title="t('tabs.closeSplit')"
                @click="closeMainPane"
              >
                <PanelRightClose class="h-4 w-4" />
              </button>
            </div>

            <div class="h-[calc(100vh-14rem)] overflow-y-auto p-4 dh-scrollbar">
              <RouterView />
            </div>
          </section>

          <section
            class="dh-glass dh-liquid min-h-[calc(100vh-10rem)] overflow-hidden rounded-[32px]"
            @dragover="handlePaneDragOver"
            @drop="dropTabToSplit"
          >
            <div class="flex items-center justify-between border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3">
              <h2 class="truncate text-sm font-black text-[var(--dh-text)]">{{ tabsStore.splitPane.title }}</h2>

              <button
                class="rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)]"
                :title="t('tabs.closeSplit')"
                @click="tabsStore.closeSplitPane()"
              >
                <PanelRightClose class="h-4 w-4" />
              </button>
            </div>

            <iframe
              :key="tabsStore.splitPane.path"
              :src="splitFrameUrl"
              class="h-[calc(100vh-14rem)] w-full border-0 bg-transparent"
              title="Split workspace"
            />
          </section>
        </div>

        <RouterView v-else />
      </main>
    </div>

    <DhCommandPalette
      v-model:query="commandQuery"
      :open="commandOpen"
      :items="filteredCommands"
      @close="commandOpen = false"
      @select="selectCommand"
    />
  </div>
</template>
