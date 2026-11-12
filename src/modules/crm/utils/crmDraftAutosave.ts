import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useAuthStore } from '@/core/stores/authStore'
import { requestCrmDraftRecovery } from './crmDraftRecoveryDialog'

/**
 * Crash-safe CRM form drafts, scoped to the authenticated user, tenant and
 * record/form. These are browser-local recovery points, NOT committed CRM data.
 * Do not include File/Blob, credentials or access tokens in capture().
 */
const PREFIX = 'dhole:crm:draft:v1:'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_DRAFT_LENGTH = 300_000

export interface CrmDraftOptions<T> {
  scope: MaybeRefOrGetter<string>
  capture: () => T
  apply: (draft: T) => void
  enabled?: MaybeRefOrGetter<boolean>
}

interface StoredCrmDraft<T> {
  version: 1
  savedAt: number
  data: T
}

function safeParse<T>(raw: string | null): StoredCrmDraft<T> | null {
  if (!raw) return null
  try {
    const candidate = JSON.parse(raw) as StoredCrmDraft<T>
    if (candidate?.version !== 1 || !Number.isFinite(candidate.savedAt)
      || candidate.savedAt > Date.now() + 60_000
      || Date.now() - candidate.savedAt > MAX_AGE_MS) return null
    return candidate
  } catch { return null }
}

export function useCrmDraftAutosave<T>(options: CrmDraftOptions<T>) {
  const auth = useAuthStore()
  const status = ref<'idle' | 'saved' | 'restored' | 'unavailable'>('idle')
  const lastSavedAt = ref<number | null>(null)
  let active = false
  let baseline = ''
  let currentKey: string | null = null
  let preserveStoredDraft = false
  let recoveryGeneration = 0
  let cancelRecovery: (() => void) | null = null

  function key() {
    const userId = String(auth.userId ?? '').trim()
    const scope = String(toValue(options.scope) ?? '').trim()
    if (!userId || !scope || !auth.isAuthenticated) return null
    return PREFIX + encodeURIComponent(String(auth.clientId ?? 'default')) + ':' +
      encodeURIComponent(userId) + ':' + encodeURIComponent(scope)
  }

  function removeStored() {
    if (!currentKey) return
    try { localStorage.removeItem(currentKey) } catch { /* Storage may be blocked. */ }
  }

  function cancelPendingRecovery() {
    recoveryGeneration++
    cancelRecovery?.()
    cancelRecovery = null
  }

  function persist() {
    if (!active || !currentKey || !auth.isAuthenticated ||
      (options.enabled !== undefined && !toValue(options.enabled))) return
    if (key() !== currentKey) { active = false; return }
    try {
      const data = options.capture()
      const serialized = JSON.stringify(data)
      if (serialized === baseline) {
        // "Más tarde" must never erase the previous unsaved draft merely
        // because the user closed this editor without touching the fields.
        if (preserveStoredDraft) return
        removeStored()
        status.value = 'idle'
        lastSavedAt.value = null
        return
      }
      if (serialized.length > MAX_DRAFT_LENGTH) {
        status.value = 'unavailable'
        return
      }
      const savedAt = Date.now()
      localStorage.setItem(currentKey, JSON.stringify({
        version: 1, savedAt, data,
      } satisfies StoredCrmDraft<T>))
      preserveStoredDraft = false
      status.value = 'saved'
      lastSavedAt.value = savedAt
    } catch {
      status.value = 'unavailable'
    }
  }

  /** Call only AFTER server state/defaults loaded; never open recovery for hidden editors. */
  function begin() {
    cancelPendingRecovery()
    active = false
    currentKey = null
    status.value = 'idle'
    lastSavedAt.value = null
    preserveStoredDraft = false

    if (options.enabled !== undefined && !toValue(options.enabled)) return
    currentKey = key()
    if (!currentKey) return

    try {
      baseline = JSON.stringify(options.capture())
      const raw = localStorage.getItem(currentKey)
      const restored = safeParse<T>(raw)
      if (raw && !restored) removeStored()

      if (restored && JSON.stringify(restored.data) !== baseline) {
        preserveStoredDraft = true
        const promptKey = currentKey
        const generation = recoveryGeneration
        const recovery = requestCrmDraftRecovery(restored.savedAt)
        cancelRecovery = recovery.cancel

        void recovery.result.then(choice => {
          // Route changes, closing a form or switching accounts invalidates
          // the old response. Never apply a draft to the wrong CRM record.
          if (generation !== recoveryGeneration || currentKey !== promptKey ||
              key() !== promptKey ||
              (options.enabled !== undefined && !toValue(options.enabled))) return
          cancelRecovery = null

          if (choice === 'restore') {
            try {
              options.apply(restored.data)
              preserveStoredDraft = false
              status.value = 'restored'
              lastSavedAt.value = restored.savedAt
            } catch {
              status.value = 'unavailable'
            }
          } else if (choice === 'discard') {
            removeStored()
            preserveStoredDraft = false
          }
          active = true
        })
        return
      }
      if (restored) removeStored()
      active = true
    } catch {
      status.value = 'unavailable'
      active = true
    }
  }

  /** Finish a successful server save. Never clear a draft on a failed request. */
  function commit() {
    cancelPendingRecovery()
    active = false
    removeStored()
    preserveStoredDraft = false
    status.value = 'idle'
    lastSavedAt.value = null
  }

  /** Close without saving to the server; keep the local recovery point. */
  function stop() {
    persist()
    active = false
    cancelPendingRecovery()
  }

  watch(options.capture, persist, { deep: true, flush: 'sync' })
  onBeforeUnmount(stop)
  return { begin, commit, stop, status, lastSavedAt }
}
