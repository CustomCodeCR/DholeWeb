import { defineStore } from 'pinia'

export interface WorkspaceTab {
  key: string
  title: string
  path: string
  closable: boolean
}

const STORAGE_KEY = 'dhole.workspace.tabs'
const ACTIVE_KEY = 'dhole.workspace.activeTab'

export const DASHBOARD_TAB: WorkspaceTab = {
  key: '/home',
  title: 'Dashboard',
  path: '/home',
  closable: false,
}

function normalizeTab(tab: WorkspaceTab): WorkspaceTab | null {
  if (!tab?.key || !tab?.path || !tab?.title) return null

  if (tab.path === '/home' || tab.key === '/home') {
    return { ...DASHBOARD_TAB }
  }

  return {
    key: tab.key,
    path: tab.path,
    title: tab.title,
    closable: tab.closable !== false,
  }
}

function ensureDashboard(tabs: WorkspaceTab[]): WorkspaceTab[] {
  const normalized = tabs
    .map(normalizeTab)
    .filter((tab): tab is WorkspaceTab => tab !== null)
    .filter((tab, index, collection) => collection.findIndex((x) => x.key === tab.key) === index)

  const withoutDashboard = normalized.filter((tab) => tab.key !== DASHBOARD_TAB.key)
  return [{ ...DASHBOARD_TAB }, ...withoutDashboard]
}

function loadTabs(): WorkspaceTab[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return ensureDashboard([])

  try {
    const parsed = JSON.parse(raw) as WorkspaceTab[]
    return ensureDashboard(Array.isArray(parsed) ? parsed : [])
  } catch {
    return ensureDashboard([])
  }
}

function loadActiveKey(tabs: WorkspaceTab[]): string {
  const stored = localStorage.getItem(ACTIVE_KEY)
  return tabs.some((tab) => tab.key === stored) ? String(stored) : DASHBOARD_TAB.key
}

export const useWorkspaceTabsStore = defineStore('workspaceTabs', {
  state: () => {
    const tabs = loadTabs()

    return {
      tabs,
      activeKey: loadActiveKey(tabs),
    }
  },

  actions: {
    persist() {
      this.tabs = ensureDashboard(this.tabs)

      if (!this.tabs.some((tab) => tab.key === this.activeKey)) {
        this.activeKey = DASHBOARD_TAB.key
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tabs))
      localStorage.setItem(ACTIVE_KEY, this.activeKey)
    },

    openTab(tab: WorkspaceTab) {
      const normalized = normalizeTab(tab)
      if (!normalized) return

      const existingIndex = this.tabs.findIndex((x) => x.key === normalized.key)

      if (existingIndex === -1) {
        this.tabs.push(normalized)
      } else {
        const existing = this.tabs[existingIndex]
        if (!existing) return

        this.tabs[existingIndex] = {
          ...existing,
          ...normalized,
          closable: existing.closable === false ? false : normalized.closable,
        }
      }

      this.activeKey = normalized.key
      this.persist()
    },

    closeTab(key: string) {
      const tab = this.tabs.find((x) => x.key === key)
      if (!tab || tab.closable === false) return

      const index = this.tabs.findIndex((x) => x.key === key)
      if (index === -1) return

      this.tabs.splice(index, 1)

      if (this.activeKey === key) {
        const next = this.tabs[index] ?? this.tabs[index - 1] ?? this.tabs[0]
        this.activeKey = next?.key ?? DASHBOARD_TAB.key
      }

      this.persist()
    },

    setActiveTab(key: string) {
      this.activeKey = this.tabs.some((tab) => tab.key === key) ? key : DASHBOARD_TAB.key
      this.persist()
    },

    clear() {
      this.tabs = [{ ...DASHBOARD_TAB }]
      this.activeKey = DASHBOARD_TAB.key
      this.persist()
    },
  },
})
