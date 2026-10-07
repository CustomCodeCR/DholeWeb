import { defineStore } from 'pinia'

export interface WorkspaceTab {
  key: string
  title: string
  titleKey?: string
  path: string
  closable: boolean
}

export interface WorkspaceSplitPane {
  key: string
  title: string
  titleKey?: string
  path: string
}

const STORAGE_KEY = 'dhole.workspace.tabs'
const ACTIVE_KEY = 'dhole.workspace.activeTab'
const SPLIT_KEY = 'dhole.workspace.splitPane'

export const DASHBOARD_TAB: WorkspaceTab = {
  key: '/home',
  title: 'Dashboard',
  titleKey: 'sidebar.dashboard',
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
    titleKey: tab.titleKey,
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

function splitPaneFromTab(tab: WorkspaceTab): WorkspaceSplitPane {
  return {
    key: tab.key,
    title: tab.title,
    titleKey: tab.titleKey,
    path: tab.path,
  }
}

function loadSplitPane(): WorkspaceSplitPane | null {
  const raw = localStorage.getItem(SPLIT_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as WorkspaceSplitPane

    if (!parsed?.key || !parsed.path || !parsed.title || parsed.path === DASHBOARD_TAB.path) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const useWorkspaceTabsStore = defineStore('workspaceTabs', {
  state: () => {
    const tabs = loadTabs()

    return {
      tabs,
      activeKey: loadActiveKey(tabs),
      splitPane: loadSplitPane() as WorkspaceSplitPane | null,
    }
  },

  getters: {
    activeTab(state): WorkspaceTab | undefined {
      return state.tabs.find((tab) => tab.key === state.activeKey)
    },
    isSplitActive(state): boolean {
      return state.splitPane !== null
    },
  },

  actions: {
    persist() {
      this.tabs = ensureDashboard(this.tabs)

      if (!this.tabs.some((tab) => tab.key === this.activeKey)) {
        this.activeKey = DASHBOARD_TAB.key
      }

      if (this.splitPane && !this.tabs.some((tab) => tab.key === this.splitPane?.key)) {
        this.splitPane = null
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tabs))
      localStorage.setItem(ACTIVE_KEY, this.activeKey)

      if (this.splitPane) {
        localStorage.setItem(SPLIT_KEY, JSON.stringify(this.splitPane))
      } else {
        localStorage.removeItem(SPLIT_KEY)
      }
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

      if (this.splitPane?.key === key) {
        this.splitPane = null
      }

      if (this.activeKey === key) {
        const next = this.tabs[index] ?? this.tabs[index - 1] ?? this.tabs[0]
        this.activeKey = next?.key ?? DASHBOARD_TAB.key
      }

      this.persist()
    },

    setActiveTab(key: string) {
      const target = this.tabs.find((tab) => tab.key === key)
      if (!target) {
        this.activeKey = DASHBOARD_TAB.key
        this.persist()
        return
      }

      // Selecting the tab that currently lives in the split swaps both panes.
      // This prevents the same route from being rendered twice.
      if (this.splitPane?.key === key) {
        const currentMain = this.tabs.find((tab) => tab.key === this.activeKey)
        this.activeKey = target.key
        this.splitPane =
          currentMain && currentMain.key !== DASHBOARD_TAB.key
            ? splitPaneFromTab(currentMain)
            : null
        this.persist()
        return
      }

      this.activeKey = target.key
      this.persist()
    },

    openSplitPane(key: string) {
      const tab = this.tabs.find((x) => x.key === key)
      if (!tab || tab.key === DASHBOARD_TAB.key) return

      if (this.splitPane?.key === key) {
        this.closeSplitPane()
        return
      }

      // If the current main tab is being moved to the split, keep a usable
      // page in the main pane instead of duplicating the same route twice.
      if (this.activeKey === key) {
        const index = this.tabs.findIndex((item) => item.key === key)
        const fallback =
          this.tabs[index - 1]
          ?? this.tabs[index + 1]
          ?? this.tabs.find((item) => item.key === DASHBOARD_TAB.key)

        this.activeKey = fallback?.key ?? DASHBOARD_TAB.key
      }

      this.splitPane = splitPaneFromTab(tab)
      this.persist()
    },

    moveTabToMain(key: string) {
      const tab = this.tabs.find((x) => x.key === key)
      if (!tab) return null

      this.setActiveTab(key)
      return tab
    },

    reorderTab(sourceKey: string, targetKey: string) {
      if (
        sourceKey === targetKey
        || sourceKey === DASHBOARD_TAB.key
        || !this.tabs.some((tab) => tab.key === sourceKey)
        || !this.tabs.some((tab) => tab.key === targetKey)
      ) {
        return
      }

      const sourceIndex = this.tabs.findIndex((tab) => tab.key === sourceKey)
      const [source] = this.tabs.splice(sourceIndex, 1)
      if (!source) return

      const targetIndex = this.tabs.findIndex((tab) => tab.key === targetKey)
      const insertAt = targetKey === DASHBOARD_TAB.key
        ? 1
        : targetIndex < 0
          ? this.tabs.length
          : targetIndex

      this.tabs.splice(insertAt, 0, source)
      this.persist()
    },

    promoteSplitPaneToMain() {
      if (!this.splitPane) return null

      const split = this.splitPane
      const tab = this.tabs.find((x) => x.key === split.key)

      this.activeKey = tab?.key ?? split.key
      this.splitPane = null
      this.persist()

      return tab ?? { ...split, closable: true }
    },

    closeSplitPane() {
      this.splitPane = null
      this.persist()
    },

    clear() {
      this.tabs = [{ ...DASHBOARD_TAB }]
      this.activeKey = DASHBOARD_TAB.key
      this.splitPane = null
      this.persist()
    },
  },
})
