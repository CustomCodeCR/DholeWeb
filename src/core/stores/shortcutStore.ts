import { defineStore } from 'pinia'

export type ShortcutAction =
  | 'global.search'
  | 'record.create'
  | 'record.save'
  | 'tab.close'
  | 'theme.toggle'
  | 'locale.toggle'

export interface ShortcutDefinition {
  action: ShortcutAction
  label: string
  keys: string
}

const STORAGE_KEY = 'dhole.shortcuts'
const MODIFIER_ORDER = ['ctrl', 'meta', 'alt', 'shift'] as const
const MODIFIER_KEYS = new Set(['control', 'ctrl', 'shift', 'alt', 'meta', 'cmd', 'command'])

const defaultShortcuts: ShortcutDefinition[] = [
  { action: 'global.search', label: 'Buscar global', keys: 'ctrl+k' },
  { action: 'record.create', label: 'Nuevo registro', keys: 'ctrl+n' },
  { action: 'record.save', label: 'Guardar registro', keys: 'ctrl+s' },
  { action: 'tab.close', label: 'Cerrar pestaña', keys: 'ctrl+w' },
  { action: 'theme.toggle', label: 'Cambiar tema', keys: 'ctrl+shift+d' },
  { action: 'locale.toggle', label: 'Cambiar idioma', keys: 'ctrl+shift+l' },
]

function normalizeKeyName(value: string): string {
  const key = value.trim().toLowerCase()

  if (key === 'control') return 'ctrl'
  if (key === 'cmd' || key === 'command') return 'meta'
  if (key === 'esc') return 'escape'
  if (key === 'return') return 'enter'
  if (key === 'del') return 'delete'
  if (key === ' ') return 'space'

  return key.replace(/\s+/g, '')
}

export function normalizeKeys(value: string): string {
  const rawParts = value
    .split('+')
    .map(normalizeKeyName)
    .filter(Boolean)

  const modifiers = MODIFIER_ORDER.filter((modifier) => rawParts.includes(modifier))
  const normalKeys = rawParts.filter((part) => !MODIFIER_KEYS.has(part))
  const mainKey = normalKeys.at(-1)

  return [...modifiers, ...(mainKey ? [mainKey] : [])].join('+')
}

export function eventToShortcut(event: KeyboardEvent): string {
  const parts: string[] = []

  if (event.ctrlKey) parts.push('ctrl')
  if (event.metaKey) parts.push('meta')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')

  const key = normalizeKeyName(event.key.length === 1 ? event.key : event.key.replace(' ', 'space'))

  if (!MODIFIER_KEYS.has(key)) {
    parts.push(key)
  }

  return normalizeKeys(parts.join('+'))
}

function loadShortcuts(): ShortcutDefinition[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultShortcuts.map((shortcut) => ({ ...shortcut }))

  try {
    const parsed = JSON.parse(raw) as ShortcutDefinition[]

    return defaultShortcuts.map((base) => {
      const custom = Array.isArray(parsed) ? parsed.find((x) => x.action === base.action) : null
      return custom ? { ...base, keys: normalizeKeys(custom.keys) } : { ...base }
    })
  } catch {
    return defaultShortcuts.map((shortcut) => ({ ...shortcut }))
  }
}

export const useShortcutStore = defineStore('shortcuts', {
  state: () => ({ shortcuts: loadShortcuts() }),

  getters: {
    byKeys: (state) => (keys: string) =>
      state.shortcuts.find((x) => normalizeKeys(x.keys) === normalizeKeys(keys)),
    byAction: (state) => (action: ShortcutAction) =>
      state.shortcuts.find((x) => x.action === action),
  },

  actions: {
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shortcuts))
    },

    updateShortcut(action: ShortcutAction, keys: string) {
      const normalized = normalizeKeys(keys)
      if (!normalized || MODIFIER_KEYS.has(normalized)) return

      const shortcut = this.shortcuts.find((x) => x.action === action)
      if (!shortcut) return

      shortcut.keys = normalized
      this.save()
    },

    reset() {
      this.shortcuts = defaultShortcuts.map((shortcut) => ({ ...shortcut }))
      this.save()
    },
  },
})
