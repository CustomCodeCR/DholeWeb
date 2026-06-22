<script setup lang="ts">
import {
  Home,
  Users,
  Shield,
  KeyRound,
  MonitorCheck,
  Settings,
  Palette,
  Keyboard,
  LockKeyhole,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const shortcutStore = useShortcutStore()
const themeStore = useThemeStore()
const localeStore = useLocale()
const tabsStore = useWorkspaceTabsStore()

const commandOpen = ref(false)
const commandQuery = ref('')

function canView(scope: string): boolean {
  return authStore.hasScope(scope)
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

const sidebarItems = computed<SidebarItem[]>(() => {
  const items: SidebarItem[] = [{ label: t('sidebar.dashboard'), path: '/home', icon: Home }]

  if (securityChildren.value.length > 0) {
    items.push({
      label: t('sidebar.security'),
      icon: LockKeyhole,
      children: securityChildren.value,
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

function dispatchShortcut(name: string) {
  window.dispatchEvent(new CustomEvent(name))
}

function isShortcutRecorderTarget(event: KeyboardEvent): boolean {
  const target = event.target
  return target instanceof Element && Boolean(target.closest('[data-dhole-shortcut-recorder="true"]'))
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
  <div class="min-h-screen">
    <DhSidebar :items="sidebarItems" />

    <div class="min-h-screen pl-80 pr-4">
      <DhTopbar @search="commandOpen = true" @logout="logout" />
      <DhWorkspaceTabs />

      <main class="p-4">
        <RouterView />
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
