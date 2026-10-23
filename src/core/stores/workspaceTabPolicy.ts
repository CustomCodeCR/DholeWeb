export const MAX_WORKSPACE_TABS = 12
export const MAX_VISIBLE_WORKSPACE_TABS = 5

// Query parameters are view state (filters, pages, wizard steps), not a new workspace.
export function workspaceTabKey(path: string): string {
  const pathname = (path || '/home').split(/[?#]/, 1)[0] || '/home'
  return pathname.replace(/\/+$/, '') || '/'
}

// Bounded history: keep Dashboard, the active page and the optional split pane.
// The oldest inactive, closable tab is removed when the workspace is full.
export function limitWorkspaceTabs<T extends { key: string; closable: boolean }>(
  tabs: T[],
  activeKey: string,
  splitKey: string | null = null,
): T[] {
  const result = [...tabs]

  while (result.length > MAX_WORKSPACE_TABS) {
    const index = result.findIndex(
      (tab) => tab.closable && tab.key !== activeKey && tab.key !== splitKey,
    )
    if (index === -1) break
    result.splice(index, 1)
  }

  return result
}

// Keep the strip compact without losing access to any open tab.
export function visibleWorkspaceTabKeys<T extends { key: string; closable: boolean }>(
  tabs: T[],
  activeKey: string,
): Set<string> {
  const pinned = tabs.filter((tab) => !tab.closable).map((tab) => tab.key)
  const slots = Math.max(1, MAX_VISIBLE_WORKSPACE_TABS - pinned.length)
  const recent = tabs.filter((tab) => tab.closable).slice(-slots).map((tab) => tab.key)
  if (!pinned.includes(activeKey) && !recent.includes(activeKey)) {
    recent.shift()
    recent.push(activeKey)
  }
  return new Set([...pinned, ...recent])
}
