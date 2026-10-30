<script setup lang="ts">
import { ref, watch, useId } from 'vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { dialCodeForCountry, internationalPhone, localPhonePart } from '../utils/crmPhone'

const props = withDefaults(defineProps<{
  modelValue: string
  countryId?: string
  label?: string
}>(), { countryId: '', label: 'Teléfono' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const phoneInputId = useId()
const dialPrefix = ref<string | null>(null)
const localNumber = ref(props.modelValue)
const loading = ref(false)
const warning = ref('')
let generation = 0

watch(() => props.modelValue, value => {
  localNumber.value = localPhonePart(value ?? '', dialPrefix.value)
}, { immediate: true })

watch(() => props.countryId, async countryId => {
  const requestId = ++generation
  const oldPrefix = dialPrefix.value
  warning.value = ''
  if (!countryId) {
    dialPrefix.value = null
    localNumber.value = props.modelValue ?? ''
    return
  }
  loading.value = true
  try {
    const country = await CatalogItemsService.getById(countryId)
    if (requestId !== generation) return
    const nextPrefix = dialCodeForCountry(country)
    if (!nextPrefix) {
      warning.value = 'Este país no tiene un código telefónico reconocido en Config. Podés ingresar el número completo con +.'
      dialPrefix.value = null
      localNumber.value = props.modelValue ?? ''
      return
    }
    const previousFull = props.modelValue ?? ''
    // On a country change keep the subscriber number, not the old country code.
    const subscriber = localPhonePart(previousFull, oldPrefix ?? nextPrefix)
    dialPrefix.value = nextPrefix
    localNumber.value = subscriber
    const formatted = internationalPhone(nextPrefix, subscriber)
    if (formatted && formatted !== previousFull) emit('update:modelValue', formatted)
  } catch {
    if (requestId !== generation) return
    warning.value = 'No se pudo obtener el código telefónico desde Config. Revisá el país o escribí el prefijo manualmente.'
    dialPrefix.value = null
    localNumber.value = props.modelValue ?? ''
  } finally { if (requestId === generation) loading.value = false }
}, { immediate: true })

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  localNumber.value = target.value
  const normalized = internationalPhone(dialPrefix.value, target.value)
  emit('update:modelValue', normalized)
}
</script>

<template>
  <div class="min-w-0 space-y-1.5" data-crm-phone-input>
    <label class="block text-xs font-bold text-[var(--dh-text-muted)]" :for="phoneInputId">
      {{ label }}
    </label>
    <div class="flex min-h-11 min-w-0 overflow-hidden rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] focus-within:border-[var(--dh-primary)]">
      <span v-if="dialPrefix" data-dial-prefix
        class="flex min-w-16 shrink-0 items-center justify-center border-r border-[var(--dh-border)] px-3 text-sm font-bold text-[var(--dh-text)]">
        {{ dialPrefix }}
      </span>
      <input :id="phoneInputId" type="tel" autocomplete="tel-national"
        inputmode="tel" :value="localNumber" :disabled="loading"
        :placeholder="dialPrefix ? 'Número sin código de país' : '+506 8313 0794'"
        class="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[var(--dh-text)] outline-none disabled:opacity-60"
        @input="onInput" />
    </div>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">Consultando prefijo del país…</p>
    <p v-else-if="warning" role="status" class="text-xs text-amber-600">{{ warning }}</p>
    <p v-else-if="dialPrefix && localNumber.startsWith('+')" class="text-xs text-[var(--dh-text-muted)]">
      Se conservará el prefijo internacional que ingresaste manualmente.
    </p>
    <p v-else-if="dialPrefix" class="text-xs text-[var(--dh-text-muted)]">Se guarda como {{ dialPrefix }}{{ localNumber.replace(/\D/g, '') || '…' }}</p>
  </div>
</template>
