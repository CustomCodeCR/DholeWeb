<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'

const props = defineProps<{ modelValue: string; label?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Use a normalized, comma-separated representation so existing CRM DTOs and
// API consumers remain compatible with the old single relationship field.
const CRM_RELATION_OPTIONS = [
  { value: 'Cliente', label: 'Cliente' },
  { value: 'Consignee', label: 'Consignee' },
  { value: 'Shipper', label: 'Shipper' },
  { value: 'Notify', label: 'Notify' },
  { value: 'Proveedor', label: 'Proveedor' },
  { value: 'Competidor', label: 'Competidor' },
  { value: 'Colaborador', label: 'Colaborador' },
  { value: 'Agente', label: 'Agente' },
  { value: 'Transportista', label: 'Transportista' },
  { value: 'Otro', label: 'Otro' },
] as const

const selected = computed(() => (props.modelValue ?? '').split(',')
  .map(x => x.trim()).filter(Boolean))
const open = ref(false)
const search = ref('')
const options = computed(() => CRM_RELATION_OPTIONS.filter(item =>
  item.label.toLocaleLowerCase('es').includes(search.value.toLocaleLowerCase('es'))))
const allSelected = computed(() => CRM_RELATION_OPTIONS.every(item =>
  selected.value.some(value => value.toLocaleLowerCase('es') === item.value.toLocaleLowerCase('es'))))

function toggle(value: string) {
  if (props.disabled) return
  const exists = selected.value.some(x => x.toLowerCase() === value.toLowerCase())
  const next = exists
    ? selected.value.filter(x => x.toLowerCase() !== value.toLowerCase())
    : [...selected.value, value]
  emit('update:modelValue', next.join(', '))
}
function toggleAll() {
  if (props.disabled) return
  emit('update:modelValue', allSelected.value ? '' : CRM_RELATION_OPTIONS.map(x => x.value).join(', '))
}
</script>

<template>
  <div class="space-y-2" data-crm-relationship-multiselect>
    <label class="block text-xs font-bold text-[var(--dh-text-muted)]">{{ label ?? 'Tipo de relación comercial' }}</label>
    <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2">
      <div class="flex flex-wrap gap-1.5">
        <button v-for="item in selected" :key="item" type="button" :disabled="disabled"
          class="inline-flex items-center gap-1 rounded-md bg-[var(--dh-card)] px-2 py-1 text-xs font-semibold text-[var(--dh-text)]"
          :aria-label="'Quitar ' + item" @click="toggle(item)">
          {{ item }} <X class="h-3 w-3" />
        </button>
        <button type="button" :disabled="disabled" class="inline-flex flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--dh-text-muted)]"
          :aria-expanded="open" @click="open=!open">
          {{ selected.length ? 'Agregar otra relación' : 'Seleccionar relaciones' }}
          <ChevronDown class="h-4 w-4" />
        </button>
      </div>
      <div v-if="open && !disabled" class="mt-2 space-y-1 border-t border-[var(--dh-border)] pt-2">
        <div class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-2">
          <Search class="h-4 w-4 text-[var(--dh-text-muted)]" />
          <input v-model="search" class="w-full min-w-0 bg-transparent py-2 text-sm outline-none"
            aria-label="Buscar tipo de relación" placeholder="Buscar una relación…" />
        </div>
        <button type="button" class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[var(--dh-shell)]"
          @click="toggleAll">
          <span class="grid h-4 w-4 place-items-center rounded border border-[var(--dh-border)]">
            <Check v-if="allSelected" class="h-3 w-3 text-[var(--dh-primary)]" />
          </span>
          {{ allSelected ? 'Deseleccionar todo' : 'Seleccionar todo' }}
        </button>
        <div class="max-h-52 overflow-y-auto">
          <button v-for="item in options" :key="item.value" type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-[var(--dh-shell)]"
            :aria-pressed="selected.some(x => x.toLowerCase() === item.value.toLowerCase())"
            @click="toggle(item.value)">
            <span class="grid h-4 w-4 place-items-center rounded border border-[var(--dh-border)]">
              <Check v-if="selected.some(x => x.toLowerCase() === item.value.toLowerCase())"
                class="h-3 w-3 text-[var(--dh-primary)]" />
            </span>
            {{ item.label }}
          </button>
          <p v-if="!options.length" class="p-2 text-xs text-[var(--dh-text-muted)]">No hay coincidencias.</p>
        </div>
        <div class="flex items-center justify-between border-t border-[var(--dh-border)] pt-2">
          <span class="text-xs text-[var(--dh-text-muted)]">{{ selected.length }} seleccionadas</span>
          <button type="button" class="rounded-lg px-2 py-1 text-xs font-bold text-[var(--dh-primary)]" @click="open=false">Listo</button>
        </div>
      </div>
    </div>
  </div>
</template>
