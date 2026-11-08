import { onScopeDispose, ref, watch, type Ref } from 'vue'
import {
  type RealtimeKind,
  type RealtimeObserver,
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
  /** Inject a test transport to mount real Vue components without enabling a release flag. */
  transport?: {
    subscribe: (observer: RealtimeObserver<T>) => () => void
    resume: (kind: RealtimeKind, id: string) => void
  }
}) {
  const conflict = ref(false)
  const conflictSnapshot = ref<RealtimeSnapshot<T> | null>(null)
  let unsubscribe: () => void = () => {}
  let generation = 0

  const stopWatch = watch(config.id, (id) => {
    const boundGeneration = ++generation
    unsubscribe()
    conflict.value = false
    conflictSnapshot.value = null
    if (!id) return
    const boundId = id
    const isCurrent = () => generation === boundGeneration && config.id.value === boundId
    try {
      unsubscribe = (config.transport?.subscribe ?? subscribeUniversalRealtime)({
        kind: config.kind,
        id: boundId,
        visible: config.visible,
        dirty: config.dirty,
        fetchSnapshot: () => config.fetchSnapshot(boundId),
        applySnapshot: snapshot => {
          if (!isCurrent()) return
          conflict.value = false
          conflictSnapshot.value = null
          config.applySnapshot(snapshot)
        },
        onConflict: (snapshot: RealtimeSnapshot<T>, _event: RealtimeInvalidation | null) => {
          if (!isCurrent()) return
          conflictSnapshot.value = snapshot
          conflict.value = true
        },
        onDenied: () => {
          // A delayed denial from a prior route cannot clear a different
          // resource after Vue reused the same component instance.
          if (!isCurrent()) return
          generation++
          conflict.value = false
          conflictSnapshot.value = null
          config.onDenied?.()
        },
        onError: (error) => {
          if (isCurrent()) config.onError?.(error)
        },
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
    if (config.id.value) (config.transport?.resume ?? ((kind, id) =>
      universalRealtimeManager.resume(kind, id)))(config.kind, config.id.value)
  }

  onScopeDispose(() => {
    generation++
    conflict.value = false
    conflictSnapshot.value = null
    stopWatch()
    unsubscribe()
  })
  return { conflict, conflictSnapshot, reconcileAfterEditorClose }
}
