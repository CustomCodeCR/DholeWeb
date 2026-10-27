import { useToastStore } from '@/core/stores/toastStore'

type NativeField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

function isField(target: EventTarget | null): target is NativeField {
  return target instanceof HTMLInputElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLTextAreaElement
}

function fieldLabel(field: NativeField) {
  const label = field.labels?.[0]?.textContent
    || field.getAttribute('aria-label')
    || field.getAttribute('placeholder')
    || field.name
    || 'Campo obligatorio'
  return label.replace(/\s*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 90)
}

/**
 * Covers native required/min/max/email validation in existing forms, including
 * older screens that do not yet use the reusable validation composable.
 * The browser normally cancels submit before Vue's @submit handler can display
 * any feedback; this captures invalid events and explains the blocked save.
 */
export function installNativeFormValidation() {
  const toast = useToastStore()
  const handledForms = new WeakSet<HTMLFormElement>()

  const onInvalid = (event: Event) => {
    if (!isField(event.target) || !event.target.form) return
    event.preventDefault()
    const form = event.target.form
    const invalid = Array.from(form.querySelectorAll<NativeField>('input:invalid, select:invalid, textarea:invalid'))
      .filter(field => !field.disabled)
    for (const field of invalid) {
      field.classList.add('dh-native-invalid')
      field.setAttribute('aria-invalid', 'true')
    }
    if (handledForms.has(form)) return
    handledForms.add(form)
    requestAnimationFrame(() => handledForms.delete(form))

    const missing = invalid.filter(field => field.validity.valueMissing)
    const fields = missing.length ? missing : invalid
    const names = [...new Set(fields.map(fieldLabel))]
    toast.show({
      type: 'warning',
      title: missing.length ? 'Faltan campos obligatorios' : 'Revise los campos marcados',
      message: `${missing.length ? 'Complete' : 'Corrija'}: ${names.join(', ')}.`,
      duration: 6500,
    })
    invalid[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    invalid[0]?.focus({ preventScroll: true })
  }

  const onFieldChange = (event: Event) => {
    if (!isField(event.target) || !event.target.classList.contains('dh-native-invalid')) return
    if (event.target.validity.valid) {
      event.target.classList.remove('dh-native-invalid')
      event.target.removeAttribute('aria-invalid')
    }
  }

  document.addEventListener('invalid', onInvalid, true)
  document.addEventListener('input', onFieldChange, true)
  document.addEventListener('change', onFieldChange, true)
  return () => {
    document.removeEventListener('invalid', onInvalid, true)
    document.removeEventListener('input', onFieldChange, true)
    document.removeEventListener('change', onFieldChange, true)
  }
}
