import { defineStore } from 'pinia'
import { ref } from 'vue'

export const AVATAR_EXPRESSIONS = [
  'mad', 'happy', 'sad', 'surprised', 'wink', 'sleepy', 'smug',
  'unsure', 'scared', 'love', 'shy', 'sick', 'thinking', 'idle',
] as const

export type AvatarExpression = (typeof AVATAR_EXPRESSIONS)[number]
export const AVATAR_AUTO_INTERVAL_MS = 30_000

// A single store keeps the topbar and Appearance preview synchronized.
export const useAvatarAppearanceStore = defineStore('avatarAppearance', () => {
  const userId = ref<string | null>(null)
  const expression = ref<AvatarExpression | null>(null)
  const automatic = ref(true)

  let consumers = 0
  let rotationTimer: ReturnType<typeof setInterval> | null = null
  let reducedMotionQuery: MediaQueryList | null = null

  const keyFor = (kind: 'mode' | 'expression') =>
    userId.value ? 'dhole.blobatar.' + kind + '.v1:' + encodeURIComponent(userId.value) : null

  function readSetting(key: string | null): string | null {
    if (!key || typeof window === 'undefined') return null
    try { return window.localStorage.getItem(key) } catch { return null }
  }

  function saveSetting(key: string | null, value: string) {
    if (!key || typeof window === 'undefined') return
    try { window.localStorage.setItem(key, value) } catch { /* Storage may be disabled. */ }
  }

  function stopRotation() {
    if (rotationTimer !== null) clearInterval(rotationTimer)
    rotationTimer = null
  }

  function rotate() {
    const current = AVATAR_EXPRESSIONS.indexOf(expression.value as AvatarExpression)
    expression.value = AVATAR_EXPRESSIONS[(current + 1) % AVATAR_EXPRESSIONS.length] ?? 'mad'
    saveSetting(keyFor('expression'), expression.value)
  }

  function syncRotation() {
    stopRotation()
    if (consumers < 1 || !userId.value || !automatic.value ||
        typeof document === 'undefined' || document.hidden || reducedMotionQuery?.matches) return
    rotationTimer = setInterval(rotate, AVATAR_AUTO_INTERVAL_MS)
  }

  function selectUser(id: string | number | null | undefined) {
    const nextId = String(id ?? '').trim() || null
    if (userId.value === nextId) return
    stopRotation()
    userId.value = nextId
    automatic.value = readSetting(keyFor('mode')) !== 'fixed'
    const saved = readSetting(keyFor('expression'))
    expression.value = AVATAR_EXPRESSIONS.find((mood) => mood === saved) ?? null
    syncRotation()
  }

  function setAutomatic(value: boolean) {
    automatic.value = value
    saveSetting(keyFor('mode'), value ? 'auto' : 'fixed')
    syncRotation()
  }

  function nextExpression() {
    rotate()
    syncRotation()
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === keyFor('mode')) automatic.value = event.newValue !== 'fixed'
    if (event.key === keyFor('expression')) {
      expression.value = AVATAR_EXPRESSIONS.find((mood) => mood === event.newValue) ?? null
    }
    if (event.key === keyFor('mode') || event.key === keyFor('expression')) syncRotation()
  }

  function start() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    consumers += 1
    if (consumers === 1) {
      reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      reducedMotionQuery.addEventListener('change', syncRotation)
      document.addEventListener('visibilitychange', syncRotation)
      window.addEventListener('storage', handleStorage)
    }
    syncRotation()
  }

  function stop() {
    consumers = Math.max(0, consumers - 1)
    if (consumers || typeof window === 'undefined' || typeof document === 'undefined') return
    stopRotation()
    reducedMotionQuery?.removeEventListener('change', syncRotation)
    reducedMotionQuery = null
    document.removeEventListener('visibilitychange', syncRotation)
    window.removeEventListener('storage', handleStorage)
  }

  return { userId, expression, automatic, selectUser, setAutomatic, nextExpression, start, stop }
})
