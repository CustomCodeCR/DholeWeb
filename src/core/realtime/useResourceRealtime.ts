import { onScopeDispose, ref, watch, type Ref } from 'vue'
import {
  type RealtimeKind,
  type RealtimeSnapshot,
  type RealtimeInvalidation,
} from '@/core/realtime/realtimeManager'
import {
  subscribeUniversalRealtime,
  universalRealtimeManager,
} from '@/core/realtime/universalRealtime'

/**
 * One resource binding per visible Vue view, never a transport per component.
 * The owner REST GET is mandatory. Dirty drafts are never overwritten;
 * the caller chooses how to resolve a newer server snapshot.
 */
export function useResourceRealtime<T>(config: {
  kind: RealtimeKind
  id: Ref<string>
  visible?: () => boolean
  dirty?: () => boolean
  fetchSnapshot: (id: string) => Promise<RealtimeSnapshot<T>>
  applySnapshot: (snapshot: RealtimeSnapshot<T>) => void
  onDenied?: () => void
  onError?: (error: unknown) => void
}) {
  const conflict = ref(false)
  const conflictSnapshot = ref<RealtimeSnapshot<T> | null>(null)
  let unsubscribe: () => void = () => {}

  const stopWatch = watch(config.id, (id) => {
    unsubscribe()
    conflict.value = false
    conflictSnapshot.value = null
    if (!id) return
    const boundId = id
    try {
      unsubscribe = subscribeUniversalRealtime({
        kind: config.kind,
        id: boundId,
        visible: config.visible,
        dirty: config.dirty,
        fetchSnapshot: () => config.fetchSnapshot(boundId),
        applySnapshot: snapshot => {
          if (config.id.value !== boundId) return
          conflict.value = false
          conflictSnapshot.value = null
          config.applySnapshot(snapshot)
        },
        onConflict: (snapshot: RealtimeSnapshot<T>, _event: RealtimeInvalidation | null) => {
          if (config.id.value !== boundId) return
          conflictSnapshot.value = snapshot
          conflict.value = true
        },
        onDenied: config.onDenied,
        onError: config.onError,
      })
    } catch {
      // Unsupported/non-GUID resource ids cannot become SignalR subscriptions.
      unsubscribe = () => {}
    }
  }, { immediate: true })

  function reconcileAfterEditorClose() {
    if (config.dirty?.()) return
    conflict.value = false
    conflictSnapshot.value = null
    if (config.id.value) universalRealtimeManager.resume(config.kind, config.id.value)
  }

  onScopeDispose(() => {
    stopWatch()
    unsubscribe()
  })
  return { conflict, conflictSnapshot, reconcileAfterEditorClose }
}
