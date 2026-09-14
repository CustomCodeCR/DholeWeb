interface PricingRateCommentState {
  value: string
  dirty: boolean
  initialized: boolean
}

const state: PricingRateCommentState = {
  value: '',
  dirty: false,
  initialized: false,
}

export function hydratePricingRateComment(value: string | null | undefined) {
  state.value = value?.trim() ?? ''
  state.dirty = false
  state.initialized = true
}

export function clearPricingRateComment() {
  state.value = ''
  state.dirty = false
  state.initialized = true
}

export function setPricingRateComment(value: string) {
  state.value = value.slice(0, 4000)
  state.dirty = true
  state.initialized = true
}

export function pendingPricingRateComment() {
  if (!state.initialized || !state.dirty) return null
  return { value: state.value }
}

export function markPricingRateCommentSaved() {
  state.dirty = false
}
