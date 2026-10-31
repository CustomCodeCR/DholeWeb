<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'
import { CRM_CREDIT_COVERAGE_OPTIONS } from '../model/crmCreditCoverage'

const props = withDefaults(defineProps<{
  modelValue: string[]; label: string; disabled?: boolean
}>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const open = ref(false)
const search = ref('')
const filtered = computed(() => CRM_CREDIT_COVERAGE_OPTIONS.filter(x =>
  x.label.toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es'))))
function toggle(code: string) {
  if (props.disabled) return
  emit('update:modelValue', props.modelValue.includes(code)
    ? props.modelValue.filter(x => x !== code) : [...props.modelValue, code])
}
</script>
<template>
  <div class="relative min-w-0 space-y-2" data-crm-credit-multiselect>
    <label class="block text-xs font-bold text-[var(--dh-text-muted)]">{{ label }}</label>
    <button type="button" class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm"
      :aria-expanded="open" :disabled="disabled" @click="open=!open">
      <span>{{ modelValue.length ? modelValue.length+' conceptos seleccionados' : 'Seleccionar uno o varios conceptos' }}</span>
      <ChevronDown class="h-4 w-4" />
    </button>
    <div v-if="open" class="absolute left-0 right-0 top-full z-50 mt-1 space-y-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-xl">
      <div class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] p-2">
        <Search class="h-4 w-4" />
        <input v-model="search" type="search" placeholder="Buscar servicio…" class="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div class="max-h-52 overflow-y-auto">
        <button v-for="item in filtered" :key="item.code" type="button"
          class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-[var(--dh-shell)]"
          :aria-pressed="modelValue.includes(item.code)" @click="toggle(item.code)">
          <Check v-if="modelValue.includes(item.code)" class="h-4 w-4 text-[var(--dh-primary)]" />
          <span v-else class="h-4 w-4" />
          {{ item.label }}
        </button>
      </div>
      <button type="button" class="w-full rounded-lg border border-[var(--dh-border)] p-2 text-xs" @click="open=false">Listo</button>
    </div>
    <div v-if="modelValue.length" class="flex flex-wrap gap-2">
      <button v-for="code in modelValue" :key="code" type="button" :disabled="disabled"
        class="inline-flex items-center gap-1 rounded-lg bg-[var(--dh-shell)] p-2 text-xs"
        @click="toggle(code)">{{ CRM_CREDIT_COVERAGE_OPTIONS.find(x=>x.code===code)?.label ?? code }} <X class="h-3 w-3" /></button>
    </div>
  </div>
</template>