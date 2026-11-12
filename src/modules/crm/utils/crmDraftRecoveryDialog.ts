import { shallowRef } from 'vue'

export type CrmDraftRecoveryChoice = 'restore' | 'discard' | 'later'

export interface CrmDraftRecoveryRequest {
  id: number
  savedAt: number
}

interface PendingRecovery extends CrmDraftRecoveryRequest {
  resolve: (choice: CrmDraftRecoveryChoice) => void
}

// A single DhModal hosts recoveries across every CRM editor. Queuing avoids
// overlapping dialogs when several editors mount at once.
export const activeCrmDraftRecovery = shallowRef<CrmDraftRecoveryRequest | null>(null)
const pending: PendingRecovery[] = []
let shown: PendingRecovery | null = null
let sequence = 0

function showNext() {
  if (shown) return
  shown = pending.shift() ?? null
  activeCrmDraftRecovery.value = shown
    ? { id: shown.id, savedAt: shown.savedAt }
    : null
}

function finish(request: PendingRecovery, choice: CrmDraftRecoveryChoice) {
  if (shown?.id === request.id) {
    shown = null
    activeCrmDraftRecovery.value = null
    request.resolve(choice)
    showNext()
    return
  }
  const index = pending.findIndex(item => item.id === request.id)
  if (index !== -1) {
    pending.splice(index, 1)
    request.resolve(choice)
  }
}

export function requestCrmDraftRecovery(savedAt: number) {
  let resolve!: (choice: CrmDraftRecoveryChoice) => void
  const result = new Promise<CrmDraftRecoveryChoice>(done => { resolve = done })
  const request: PendingRecovery = { id: ++sequence, savedAt, resolve }
  pending.push(request)
  showNext()
  // Closing a form before the answer cancels the prompt without discarding its draft.
  return {
    result,
    cancel: () => finish(request, 'later'),
  }
}

export function decideCrmDraftRecovery(choice: CrmDraftRecoveryChoice) {
  if (shown) finish(shown, choice)
}
