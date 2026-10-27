import { computed, nextTick, ref } from 'vue'
import { useToastStore } from '@/core/stores/toastStore'

/** Reusable validation feedback for Dhole creation and editing flows. */
export interface RequiredFieldIssue {
  key: string
  label: string
}

export function useRequiredFieldFeedback(collectIssues: () => RequiredFieldIssue[]) {
  const toast = useToastStore()
  const attempted = ref(false)
  const missingFields = computed(collectIssues)
  const invalidFields = computed(() =>
    new Set(attempted.value ? missingFields.value.map((issue) => issue.key) : []),
  )

  function isInvalid(key: string) {
    return invalidFields.value.has(key)
  }

  function fieldError(key: string) {
    return isInvalid(key) ? 'Este campo es obligatorio.' : undefined
  }

  function resetValidation() {
    attempted.value = false
  }

  function validateRequiredFields() {
    attempted.value = true
    const issues = missingFields.value
    if (!issues.length) return true

    const labels = [...new Set(issues.map((issue) => issue.label))]
    toast.show({
      title: labels.length === 1 ? 'Falta un campo obligatorio' : `Faltan ${labels.length} campos obligatorios`,
      message: `Complete: ${labels.join(', ')}.`,
      type: 'warning',
      duration: 6500,
    })

    const firstKey = issues[0]?.key
    void nextTick(() => {
      if (!firstKey) return
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-required-field]'))
        .find((element) => element.dataset.requiredField === firstKey)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const control = target.matches('input, select, textarea, button, summary')
        ? target
        : target.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, button:not(:disabled)')
      control?.focus({ preventScroll: true })
    })

    return false
  }

  return { fieldError, isInvalid, missingFields, resetValidation, validateRequiredFields }
}
