import { onBeforeUnmount, onMounted, watch } from 'vue'

interface RealtimeMutationDetail {
  endpoint?: unknown
  method?: unknown
}

export interface RealtimeListRefreshOptions {
  /** Owner-scoped REST paths, not a permission bypass. */
  prefixes: readonly string[]
  refresh: () => Promise<unknown> | void
  /** Keep an unsaved edit intact; reconcile the list after editing ends. */
  isEditing?: () => boolean
  debounceMs?: number
}

/**
 * Refresh a mounted list from its existing authenticated REST endpoint when
 * another user changes data. Real-time events are invalidations, never data.
 * Debounce bursty creates/edits and avoid overwriting forms being edited.
 */
export function useRealtimeListRefresh(options: RealtimeListRefreshOptions): void {
  let timer: number | null = null
  let deferred = false
  let disposed = false
  const debounceMs = Math.max(100, Math.min(1000, options.debounceMs ?? 250))

  function queueRefresh() {
    if (disposed) return
    if (options.isEditing?.()) {
      deferred = true
      return
    }
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      if (!disposed && !options.isEditing?.())
        void Promise.resolve(options.refresh()).catch(error => {
          console.error('[DholeRealtime] No se pudo conciliar la lista.', error)
        })
      else deferred = true
    }, debounceMs)
  }

  function onMutation(raw: Event) {
    const detail = (raw as CustomEvent<RealtimeMutationDetail>).detail
    if (detail?.method !== 'SIGNALR' || typeof detail.endpoint !== 'string')
      return
    if (!options.prefixes.some(path =>
      detail.endpoint === path || detail.endpoint.startsWith(path + '/')))
      return
    queueRefresh()
  }

  onMounted(() => {
    window.addEventListener('dhole:data:changed', onMutation)
  })
  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('dhole:data:changed', onMutation)
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  })
  if (options.isEditing) {
    watch(options.isEditing, editing => {
      if (!editing && deferred) {
        deferred = false
        queueRefresh()
      }
    })
  }
}
